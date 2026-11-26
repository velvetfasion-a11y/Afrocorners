import { json } from "@/lib/server/guard";
import { adminFromRequest } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await adminFromRequest(req);
  if (!user) return json({ user: null });
  return json({ user: { email: user.email } });
}
