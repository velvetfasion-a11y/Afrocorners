import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import type { CustomerProfile } from "../offers";
import { firebaseAdminApp } from "./firebase-admin";
import { readCustomer, writeCustomer } from "./db";

export class InvalidCustomerToken extends Error {
  constructor() {
    super("Google-inloggningen godkändes inte.");
  }
}

function favoritesOf(existing: CustomerProfile | null): string[] {
  return Array.isArray(existing?.favorites) ? existing.favorites.filter((id) => typeof id === "string").slice(0, 100) : [];
}

/** Loads the customer and fills createdAt on the server. Clients cannot set that date. */
export async function ensureCustomer(decoded: DecodedIdToken): Promise<CustomerProfile> {
  if (decoded.firebase?.sign_in_provider !== "google.com" || decoded.email_verified !== true || !decoded.email) {
    throw new InvalidCustomerToken();
  }
  const email = decoded.email.trim().toLowerCase();
  const existing = await readCustomer(decoded.uid);
  const now = new Date().toISOString();
  if (!existing) {
    const created: CustomerProfile = {
      uid: decoded.uid,
      email,
      name: (decoded.name || email).slice(0, 80),
      favorites: [],
      createdAt: now,
      firstOrderAt: null,
      orderCount: 0,
    };
    await writeCustomer(created);
    return created;
  }
  const profile: CustomerProfile = {
    ...existing,
    email,
    name: (existing.name || decoded.name || email).slice(0, 80),
    favorites: favoritesOf(existing),
    createdAt: existing.createdAt || now,
    firstOrderAt: existing.firstOrderAt ?? null,
    orderCount: typeof existing.orderCount === "number" && existing.orderCount >= 0 ? existing.orderCount : 0,
  };
  if (profile.createdAt !== existing.createdAt || profile.email !== existing.email || profile.orderCount !== existing.orderCount || profile.firstOrderAt !== existing.firstOrderAt) {
    await writeCustomer(profile);
  }
  return profile;
}

export async function customerFromRequest(req: Request): Promise<CustomerProfile | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const app = firebaseAdminApp();
  if (!app) throw new InvalidCustomerToken();
  const { getAuth } = await import("firebase-admin/auth");
  try {
    const decoded = await getAuth(app).verifyIdToken(token);
    return await ensureCustomer(decoded);
  } catch (error) {
    if (error instanceof InvalidCustomerToken) throw error;
    throw new InvalidCustomerToken();
  }
}
