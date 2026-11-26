import { normalizeName } from "@/lib/format";
import { intentFromMappedPending, pieceCount } from "@/lib/sumup/plan";
import { applyMovement, readDatabase, saveSumupState } from "@/lib/server/db";
import { isUser, json, requireAdmin } from "@/lib/server/guard";
import type { SumupLocationMapping, SumupProductMapping } from "@/lib/types";

export async function PUT(req: Request) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const body = (await req.json().catch(() => ({}))) as {
    locationMappings?: SumupLocationMapping[];
    productMappings?: SumupProductMapping[];
    syncFrom?: string;
    channels?: string[];
    dismissPending?: string;
    mapPending?: { pendingId: string; productId: string };
  };
  const db = await readDatabase();
  const sumup = { ...db.sumup };
  if (body.locationMappings) sumup.locationMappings = body.locationMappings;
  if (body.productMappings) sumup.productMappings = body.productMappings;
  if (body.syncFrom) sumup.syncFrom = new Date(body.syncFrom).toISOString();
  if (body.channels) sumup.channels = body.channels.filter(Boolean);
  if (body.dismissPending) sumup.pending = sumup.pending.filter((item) => item.id !== body.dismissPending);
  if (body.mapPending) {
    const item = sumup.pending.find((entry) => entry.id === body.mapPending?.pendingId);
    const product = db.products.find((entry) => entry.id === body.mapPending?.productId);
    if (!item || !product) return json({ error: "Välj en väntande rad och en produkt." }, 400);
    const key = item.sku ? `sku:${normalizeName(item.sku)}` : `name:${normalizeName(item.name)}`;
    if (!sumup.productMappings.some((mapping) => mapping.key === key)) {
      sumup.productMappings.push({ id: crypto.randomUUID(), key, label: item.name || item.sku, productId: product.id });
    }
    const counted = pieceCount(item.quantity || 1, "each");
    const pieces = "pieces" in counted ? counted.pieces : 1;
    const intent = intentFromMappedPending({ ...item, storeId: item.storeId }, { id: product.id, name: product.name, sku: product.sku }, Math.max(1, pieces));
    if (!intent) return json({ error: "Koppla först SumUp-kontot till en butik, så vet vi var lagret ska ändras." }, 400);
    await applyMovement(intent);
    sumup.pending = sumup.pending.filter((entry) => entry.id !== item.id);
  }
  await saveSumupState(sumup);
  return json({ sumup });
}
