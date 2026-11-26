import { applyMovement } from "@/lib/server/db";
import { isUser, json, requireAdmin } from "@/lib/server/guard";
import type { StockMovementInput, StockReason } from "@/lib/types";

const REASONS: StockReason[] = ["in_store_sale", "restock", "manual"];

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const body = (await req.json().catch(() => null)) as Partial<StockMovementInput> | null;
  if (!body || (body.storeId !== "fittja" && body.storeId !== "marsta") || !body.productId) {
    return json({ error: "Välj butik och produkt." }, 400);
  }
  if (!body.reason || !REASONS.includes(body.reason)) return json({ error: "Ogiltig orsak." }, 400);
  const delta = Math.round(Number(body.delta));
  if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 999) {
    return json({ error: "Ange ett antal." }, 400);
  }
  try {
    const result = await applyMovement({
      storeId: body.storeId,
      productId: body.productId,
      delta,
      reason: body.reason,
      source: "admin",
      note: body.note,
    });
    return json({ result });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Kunde inte ändra lagret." }, 400);
  }
}
