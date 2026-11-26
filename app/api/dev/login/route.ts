import { timingSafeEqual } from "crypto";
import { devClearCookie, devSecret, devSetCookie, isDeveloper } from "@/lib/server/dev-session";
import { json } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!devSecret()) return json({ enabled: false }, 404);
  return json({ enabled: true, ok: isDeveloper(req) });
}

export async function POST(req: Request) {
  const secret = devSecret();
  if (!secret) return json({ error: "Utvecklarsidan är avstängd." }, 404);
  const body = (await req.json().catch(() => ({}))) as { secret?: string };
  const given = body.secret ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: "Fel nyckel." }, 401);
  return json({ ok: true }, 200, { "Set-Cookie": devSetCookie() });
}

export async function DELETE() {
  return json({ ok: true }, 200, { "Set-Cookie": devClearCookie() });
}
