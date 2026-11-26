import { readDatabase } from "@/lib/server/db";
import { isUser, json, requireAdmin } from "@/lib/server/guard";
import { listConnections, publicConnection } from "@/lib/server/secrets";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const [connections, db] = await Promise.all([listConnections(), readDatabase()]);
  return json({
    oauth: Boolean(process.env.SUMUP_CLIENT_ID && process.env.SUMUP_CLIENT_SECRET),
    connections: connections.map(publicConnection),
    sumup: db.sumup,
  });
}
