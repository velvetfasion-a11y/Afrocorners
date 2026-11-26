import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { parseAdminEmails, type AdminRole } from "./allowlist";
import { firebaseAdminApp } from "./firebase-admin";

export interface AllowedAdmin {
  email: string;
  role: AdminRole;
  uid: string;
}

export async function allowGoogleAdmin(decoded: DecodedIdToken): Promise<AllowedAdmin | null> {
  if (decoded.firebase?.sign_in_provider !== "google.com") return null;
  if (decoded.email_verified !== true || !decoded.email) return null;
  const email = decoded.email.trim().toLowerCase();
  const fromEnv = parseAdminEmails(process.env.ADMIN_EMAILS);
  let role: AdminRole | null = fromEnv.get(email) ?? null;

  const app = firebaseAdminApp();
  if (app && fromEnv.size === 0) {
    const { getFirestore } = await import("firebase-admin/firestore");
    const snap = await getFirestore(app).doc(`admins/${decoded.uid}`).get();
    const data = snap.data() as { email?: string; role?: string } | undefined;
    if (data?.email?.trim().toLowerCase() === email && (data.role === "owner" || data.role === "developer")) {
      role = data.role;
    }
  }
  if (!role) return null;
  return { email, role, uid: decoded.uid };
}

/** Written only after the access code has also been accepted. */
export async function mirrorAdminDoc(admin: AllowedAdmin): Promise<void> {
  const app = firebaseAdminApp();
  if (!app) return;
  const { getFirestore } = await import("firebase-admin/firestore");
  await getFirestore(app).doc(`admins/${admin.uid}`).set(
    { email: admin.email, role: admin.role, provider: "google", updatedAt: new Date().toISOString() },
    { merge: true },
  );
}
