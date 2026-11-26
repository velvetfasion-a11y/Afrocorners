import { json } from "@/lib/server/guard";
import { sessionClearCookie } from "@/lib/server/session";

export async function POST() {
  return json({ ok: true }, 200, { "Set-Cookie": sessionClearCookie() });
}
