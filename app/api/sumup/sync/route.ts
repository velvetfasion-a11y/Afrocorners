import { syncSumup } from "@/lib/sumup/sync";
import { cronAuthorized, isUser, json, requireAdmin } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

async function run(req: Request) {
  if (!cronAuthorized(req)) {
    const admin = await requireAdmin(req);
    if (!isUser(admin)) return admin;
  }
  try {
    const report = await syncSumup();
    return json(report);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Synken misslyckades." }, 500);
  }
}

export function GET(req: Request) {
  return run(req);
}

export function POST(req: Request) {
  return run(req);
}
