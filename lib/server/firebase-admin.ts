import "server-only";

import { readFileSync } from "fs";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";

export function firebaseAdminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
}

export function firebaseAdminApp(): App | null {
  if (!firebaseAdminConfigured()) return null;
  const existing = getApps()[0];
  if (existing) return existing;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    ? process.env.FIREBASE_SERVICE_ACCOUNT
    : readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH as string, "utf8");
  const credentials = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
  return initializeApp({
    credential: cert({
      projectId: credentials.project_id,
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key,
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export function usingFirebase(): boolean {
  return firebaseAdminConfigured() && Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

/** The open local preview login. Never available in production unless explicitly forced. */
export function demoAdminAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_ADMIN === "1";
}
