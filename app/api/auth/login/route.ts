import { json } from "@/lib/server/guard";
import { firebaseAdminApp, usingFirebase } from "@/lib/server/firebase-admin";
import { loginAllowed, sessionSetCookie, signSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!loginAllowed(ip)) return json({ error: "För många försök. Vänta en stund." }, 429);
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string; idToken?: string };

  if (usingFirebase()) {
    if (!body.idToken) return json({ error: "Logga in med butikens Firebase-konto." }, 400);
    const { getAuth } = await import("firebase-admin/auth");
    const { getFirestore } = await import("firebase-admin/firestore");
    const app = firebaseAdminApp();
    if (!app) return json({ error: "Firebase Admin saknas på servern." }, 500);
    try {
      const decoded = await getAuth(app).verifyIdToken(body.idToken);
      const adminDoc = await getFirestore(app).doc(`admins/${decoded.uid}`).get();
      if (!adminDoc.exists) {
        return json({ error: "Kontot är inte butiksägare. Skapa dokumentet admins/{uid} i Firestore." }, 403);
      }
      const token = await signSession({ uid: decoded.uid, email: decoded.email ?? "" });
      return json({ email: decoded.email }, 200, { "Set-Cookie": sessionSetCookie(token) });
    } catch {
      return json({ error: "Inloggningen godkändes inte." }, 401);
    }
  }

  const email = process.env.DEMO_ADMIN_EMAIL || "agare@afrocorner.se";
  const password = process.env.DEMO_ADMIN_PASSWORD || "demo1234";
  if (body.email !== email || body.password !== password) {
    return json({ error: "Fel e-post eller lösenord." }, 401);
  }
  const token = await signSession({ uid: "demo-owner", email });
  return json({ email }, 200, { "Set-Cookie": sessionSetCookie(token) });
}
