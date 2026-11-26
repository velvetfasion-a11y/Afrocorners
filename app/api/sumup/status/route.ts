import { listConnections } from "@/lib/server/secrets";
import { isUser, json, requireAdmin } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

/** Owner-safe status. No keys, merchant codes, or unmatched rows. */
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const connections = await listConnections();
  return json({ configured: connections.some((item) => item.apiKey && item.storeId) });
}
