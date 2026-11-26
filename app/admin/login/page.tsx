"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Mode = {
  mode: "google" | "demo";
  codeRequired: boolean;
  ready: boolean;
  firebase: Record<string, string> | null;
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState<"start" | "code" | "denied">("start");
  const [idToken, setIdToken] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/mode").then((response) => response.json()).then(setMode);
  }, []);

  async function signOutGoogle() {
    if (!mode?.firebase) return;
    const { initializeApp, getApps } = await import("firebase/app");
    const { getAuth, signOut } = await import("firebase/auth");
    const app = getApps()[0] ?? initializeApp(mode.firebase);
    await signOut(getAuth(app)).catch(() => undefined);
  }

  async function google() {
    if (!mode?.firebase) return;
    setError("");
    setBusy(true);
    try {
      const { initializeApp, getApps } = await import("firebase/app");
      const { getAuth, GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      const app = getApps()[0] ?? initializeApp(mode.firebase);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(getAuth(app), provider);
      const token = await cred.user.getIdToken();
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token, code: "" }),
      });
      const data = await response.json();
      if (data.code === "forbidden") {
        await signOutGoogle();
        setStep("denied");
        return;
      }
      if (data.code === "needs-code") {
        setIdToken(token);
        setStep("code");
        setError("");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Kunde inte logga in.");
      router.replace("/admin");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Google-inloggningen avbröts.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, code }),
      });
      const data = await response.json();
      if (data.code === "forbidden") {
        await signOutGoogle();
        setStep("denied");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Fel kod.");
      setCode("");
      router.replace("/admin");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Fel kod.");
    } finally {
      setBusy(false);
    }
  }

  async function demo(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo: true, code: mode?.codeRequired ? code : undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kunde inte öppna förhandsvisningen.");
      setCode("");
      router.replace("/admin");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunde inte öppna förhandsvisningen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-cream px-4 text-ink">
      <h1 className="font-display text-4xl">Afro<span className="italic text-gold">Corner</span></h1>
      <p className="mt-2 text-muted">Butikens admin. Bara godkända Google-konton kommer in.</p>
      {!mode && <p className="mt-6 text-sm text-muted">Hämtar inloggning…</p>}
      {mode?.mode === "demo" && (
        <form className="mt-6 space-y-3" onSubmit={demo}>
          <p className="rounded-2xl bg-[#f3e2b8] px-3 py-3 text-sm text-bark">Lokal förhandsvisning. Firebase är inte påslaget, så Google används inte. Det här läget finns bara på den här datorn.</p>
          {mode.codeRequired && (
            <Label>Åtkomstkod
              <Input className="mt-1 h-12" type="password" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} />
            </Label>
          )}
          {error && <p className="text-sm text-red-900">{error}</p>}
          <Button type="submit" className="h-12 w-full" disabled={busy}>Fortsätt i förhandsvisning</Button>
        </form>
      )}
      {mode?.mode === "google" && !mode.ready && (
        <p className="mt-6 rounded-2xl bg-paper px-3 py-3 text-sm">Inloggningen är inte färdigkonfigurerad ännu.</p>
      )}
      {mode?.mode === "google" && mode.ready && step === "start" && (
        <div className="mt-6 space-y-3">
          {error && <p className="text-sm text-red-900">{error}</p>}
          <Button type="button" className="h-12 w-full" disabled={busy} onClick={google}>Logga in med Google</Button>
        </div>
      )}
      {mode?.mode === "google" && step === "code" && (
        <form className="mt-6 space-y-3" onSubmit={submitCode}>
          <p className="text-sm text-muted">Google är godkänd. Skriv åtkomstkoden.</p>
          <Label>Åtkomstkod
            <Input className="mt-1 h-12" type="password" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} />
          </Label>
          {error && <p className="text-sm text-red-900">{error}</p>}
          <Button type="submit" className="h-12 w-full" disabled={busy}>Fortsätt</Button>
        </form>
      )}
      {step === "denied" && (
        <div className="mt-6 rounded-3xl bg-paper p-5">
          <h2 className="font-display text-3xl">Ingen behörighet</h2>
          <p className="mt-2 text-sm text-muted">Det här Google-kontot får inte öppna admin. Du är utloggad.</p>
        </div>
      )}
    </main>
  );
}
