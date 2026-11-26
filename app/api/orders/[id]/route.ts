import { transitionOrder } from "@/lib/server/db";
import { isUser, json, requireAdmin } from "@/lib/server/guard";
import type { OrderStatus, StoreId } from "@/lib/types";

const STATUSES: OrderStatus[] = ["ny", "bekraftad", "betald", "klar", "avbruten"];

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { status?: OrderStatus; shipFrom?: StoreId };
  if (!body.status || !STATUSES.includes(body.status)) return json({ error: "Ogiltig status." }, 400);
  const shipFrom = body.shipFrom === "marsta" ? "marsta" : "fittja";
  try {
    const order = await transitionOrder(id, body.status, shipFrom);
    return json({ order });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Kunde inte uppdatera ordern." }, 400);
  }
}
