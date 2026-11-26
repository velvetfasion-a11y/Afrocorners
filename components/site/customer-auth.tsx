"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeFavorites, type CustomerProfile, type ShopOffer } from "@/lib/offers";

export interface ShopAccount {
  customer: CustomerProfile;
  offers: ShopOffer[];
  orders: import("@/lib/types").Order[];
  getIdToken: () => Promise<string>;
}

type FirebaseConfig = Record<string, string>;

async function clientAuth(config: FirebaseConfig) {
  const { initializeApp, getApps } = await import("firebase/app");
  const { getAuth } = await import("firebase/auth");
  const app = getApps()[0] ?? initializeApp(config);
  return getAuth(app);
}

async function writeFavorites(config: FirebaseConfig, uid: string, favorites: string[]) {
  const { getFirestore, doc, setDoc } = await import("firebase/firestore");
  const { initializeApp, getApps } = await import("firebase/app");
  const app = getApps()[0] ?? initializeApp(config);
  await setDoc(doc(getFirestore(app), "customers", uid), { favorites: favorites.slice(0, 100) }, { merge: true });
}

export function useCustomerSession(setFavorites: (value: string[] | ((current: string[]) => string[])) => void) {
  const [account, setAccount] = useState<ShopAccount | null>(null);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const configRef = useRef<FirebaseConfig | null>(null);
  const uidRef = useRef<string | null>(null);
  const allowRemote = useRef(false);
  const favoritesRef = useRef<string[]>([]);

  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    (async () => {
      try {
        const mode = await fetch("/api/auth/mode").then((response) => response.json()) as { firebase?: FirebaseConfig | null };
        if (cancelled) return;
        if (!mode.firebase) {
          setConfigured(false);
          setReady(true);
          return;
        }
        configRef.current = mode.firebase;
        setConfigured(true);
        const auth = await clientAuth(mode.firebase);
        const { onAuthStateChanged, getRedirectResult } = await import("firebase/auth");
        await getRedirectResult(auth).catch(() => undefined);
        stop = onAuthStateChanged(auth, async (user) => {
          if (!user) {
            uidRef.current = null;
            allowRemote.current = false;
            setAccount(null);
            setReady(true);
            return;
          }
          const token = await user.getIdToken();
          const response = await fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } });
          const data = await response.json();
          if (!response.ok) {
            setAccount(null);
            setReady(true);
            return;
          }
          const local = JSON.parse(localStorage.getItem("afrocorner-favorites") || "[]") as string[];
          const merged = mergeFavorites(data.customer.favorites ?? [], Array.isArray(local) ? local : []);
          if (merged.join() !== (data.customer.favorites ?? []).join()) {
            const { getFirestore, doc, setDoc } = await import("firebase/firestore");
            const { initializeApp, getApps } = await import("firebase/app");
            const app = getApps()[0] ?? initializeApp(mode.firebase!);
            await setDoc(doc(getFirestore(app), "customers", user.uid), {
              uid: user.uid,
              email: data.customer.email,
              name: data.customer.name,
              favorites: merged,
            }, { merge: true });
          }
          uidRef.current = user.uid;
          favoritesRef.current = merged;
          allowRemote.current = true;
          setFavorites(merged);
          setAccount({
            customer: { ...data.customer, favorites: merged },
            offers: data.offers ?? [],
            orders: data.orders ?? [],
            getIdToken: () => user.getIdToken(),
          });
          setReady(true);
        });
      } catch {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [setFavorites]);

  const signIn = useCallback(async () => {
    const config = configRef.current;
    if (!config) throw new Error("Google-inloggning är inte påslagen.");
    const auth = await clientAuth(config);
    const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import("firebase/auth");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (ios) {
      await signInWithRedirect(auth, provider);
      return;
    }
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment" || code === "auth/cancelled-popup-request") {
        await signInWithRedirect(auth, provider);
        return;
      }
      if (code === "auth/popup-closed-by-user") return;
      throw error;
    }
  }, []);

  const signOutAccount = useCallback(async () => {
    const config = configRef.current;
    allowRemote.current = false;
    uidRef.current = null;
    setAccount(null);
    if (!config) return;
    const auth = await clientAuth(config);
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  }, []);

  const refreshAccount = useCallback(async () => {
    const config = configRef.current;
    const uid = uidRef.current;
    if (!config || !uid) return;
    const auth = await clientAuth(config);
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const data = await response.json();
    setAccount((current) => current ? {
      ...current,
      customer: data.customer,
      offers: data.offers ?? [],
      orders: data.orders ?? [],
    } : current);
  }, []);

  const rememberFavorites = useCallback((favorites: string[]) => {
    favoritesRef.current = favorites;
    const uid = uidRef.current;
    const config = configRef.current;
    if (!allowRemote.current || !uid || !config) return;
    void writeFavorites(config, uid, favorites).catch(() => undefined);
  }, []);

  return { account, ready, configured, signIn, signOutAccount, rememberFavorites, refreshAccount };
}
