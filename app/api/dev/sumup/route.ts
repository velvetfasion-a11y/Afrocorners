import { syncSumup } from "@/lib/sumup/sync";
import { applyMovement, readDatabase, saveSumupState } from "@/lib/server/db";
import { isUser, json, requireDeveloper } from "@/lib/server/guard";
import { connectionsFromEnv } from "@/lib/server/secrets";
import { intentFromMappedPending, pieceCount } from "@/lib/sumup/plan";
import { normalizeName } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const dev = await requireDeveloper(req);
  if (!isUser(dev)) return dev;
  const db = await readDatabase();
  const accounts = connectionsFromEnv().map((item) => ({
    storeId: item.storeId,
    merchantCode: item.merchantCode || "(hämtas vid synk)",
    keyHint: item.keyHint,
  }));
  return json({
    accounts,
    pending: db.sumup.pending,
    lastSummary: db.sumup.lastSummary,
    lastError: db.sumup.lastError,
    lastSyncAt: db.sumup.lastSyncAt,
    products: db.products.map((product) => ({ id: product.id, name: product.name, sku: product.sku })),
  });
}

export async function POST(req: Request) {
  const dev = await requireDeveloper(req);
  if (!isUser(dev)) return dev;
  const body = (await req.json().catch(() => ({}))) as { action?: string; pendingId?: string; productId?: string };
  if (body.action === "sync") {
    const report = await syncSumup();
    return json(report);
  }
  const db = await readDatabase();
  const sumup = { ...db.sumup };
  if (body.action === "dismiss" && body.pendingId) {
    sumup.pending = sumup.pending.filter((item) => item.id !== body.pendingId);
    await saveSumupState(sumup);
    return json({ sumup });
  }
  if (body.action === "map" && body.pendingId && body.productId) {
    const item = sumup.pending.find((entry) => entry.id === body.pendingId);
    const product = db.products.find((entry) => entry.id === body.productId);
    if (!item || !product) return json({ error: "Rad eller produkt saknas." }, 400);
    const key = item.sku ? `sku:${normalizeName(item.sku)}` : `name:${normalizeName(item.name)}`;
    if (!sumup.productMappings.some((mapping) => mapping.key === key)) {
      sumup.productMappings.push({ id: crypto.randomUUID(), key, label: item.name || item.sku, productId: product.id });
    }
    const counted = pieceCount(item.quantity || 1, "each");
    const pieces = "pieces" in counted ? Math.max(1, counted.pieces) : 1;
    const intent = intentFromMappedPending(item, { id: product.id, name: product.name, sku: product.sku }, pieces);
    if (intent) await applyMovement(intent);
    sumup.pending = sumup.pending.filter((entry) => entry.id !== item.id);
    await saveSumupState(sumup);
    return json({ ok: true });
  }
  return json({ error: "Okänd åtgärd." }, 400);
}
