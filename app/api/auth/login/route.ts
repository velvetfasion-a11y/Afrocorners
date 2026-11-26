import {
  accessAttemptKey,
  accessCodeConfigured,
  clearAccessFailures,
  lockoutMessage,
  recordAccessFailure,
  verifyAccessCode,
} from "@/lib/server/access-code";
import { allowGoogleAdmin, mirrorAdminDoc } from "@/lib/server/google-admin";
import { json } from "@/lib/server/guard";
import { firebaseAdminApp, usingFirebase } from "@/lib/server/firebase-admin";
import { loginAllowed, sessionClearCookie, sessionSetCookie, signSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!loginAllowed(ip)) return json({ error: "För många försök. Vänta en stund." }, 429);
  const body = (await req.json().catch(() => ({}))) as { idToken?: string; code?: string; demo?: boolean };

  if (!usingFirebase()) {
    if (body.demo !== true) return json({ error: "Den här förhandsvisningen har ingen Google-inloggning." }, 400);
    const codeOk = await codeIsAccepted(body.code, "demo-local", ip);
    if (codeOk) return codeOk;
    const token = await signSession({ uid: "demo-owner", email: "lokal-forhandsvisning@afrocorner.local", role: "owner", method: "demo" });
    return json({ email: "lokal förhandsvisning", demo: true }, 200, { "Set-Cookie": sessionSetCookie(token) });
  }

  if (!body.idToken) return json({ error: "Logga in med Google." }, 400);
  if (body.demo) return json({ error: "Demoläge är avstängt." }, 403);
  if (!accessCodeConfigured()) return json({ error: "Inloggningen är inte färdigkonfigurerad." }, 503);

  const app = firebaseAdminApp();
  if (!app) return json({ error: "Firebase Admin saknas på servern." }, 500);
  const { getAuth } = await import("firebase-admin/auth");
  let decoded;
  try {
    decoded = await getAuth(app).verifyIdToken(body.idToken);
  } catch {
    return json({ error: "Google-inloggningen godkändes inte." }, 401);
  }
  const admin = await allowGoogleAdmin(decoded);
  if (!admin) {
    return json({ error: "Ingen behörighet.", code: "forbidden" }, 403, { "Set-Cookie": sessionClearCookie() });
  }

  const codeResult = await codeIsAccepted(body.code, admin.email, ip);
  if (codeResult) return codeResult;
  await mirrorAdminDoc(admin);

  const token = await signSession({ uid: admin.uid, email: admin.email, role: admin.role, method: "google" });
  return json({ email: admin.email, role: admin.role }, 200, { "Set-Cookie": sessionSetCookie(token) });
}

async function codeIsAccepted(code: string | undefined, email: string, ip: string): Promise<Response | null> {
  if (!accessCodeConfigured()) return null;
  if (!code?.trim()) return json({ error: "Åtkomstkod krävs.", code: "needs-code" }, 401);
  const keys = [accessAttemptKey(email, ip), accessAttemptKey("*", ip)];
  for (const key of keys) {
    const locked = lockoutMessage(key);
    if (locked) return json({ error: locked, code: "locked" }, 429);
  }
  const ok = await verifyAccessCode(code ?? "", process.env.ADMIN_ACCESS_CODE_HASH);
  if (!ok) {
    for (const key of keys) recordAccessFailure(key);
    const locked = lockoutMessage(keys[0]) || lockoutMessage(keys[1]);
    if (locked) return json({ error: locked, code: "locked" }, 429);
    return json({ error: "Fel kod.", code: "bad-code" }, 401);
  }
  for (const key of keys) clearAccessFailures(key);
  return null;
}
