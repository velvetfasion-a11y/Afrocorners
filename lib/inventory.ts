import type { Order, Product, StockLogEntry, StockMovementInput, StoreId } from "./types";

/**
 * Every stock change goes through commitMovement.
 * SumUp sync, in-store sales, restocks, manual +/- and completed orders
 * all use the same write. A repeated externalRef is ignored, which is what
 * makes SumUp polling and webhook retries safe.
 */
export interface InventoryPort {
  getProduct(id: string): Promise<Product | null>;
  saveProduct(product: Product): Promise<void>;
  findLogByExternalRef(ref: string): Promise<StockLogEntry | null>;
  addLog(entry: StockLogEntry): Promise<void>;
}

export interface CommitResult {
  applied: boolean;
  skippedDuplicate: boolean;
  appliedChange: number;
  entry: StockLogEntry | null;
}

export function nextStockLevel(current: number, delta: number): { next: number; applied: number } {
  const next = Math.max(0, current + delta);
  return { next, applied: next - current };
}

export async function commitMovement(
  port: InventoryPort,
  input: StockMovementInput,
  now = new Date(),
): Promise<CommitResult> {
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    return { applied: false, skippedDuplicate: false, appliedChange: 0, entry: null };
  }
  if (input.externalRef) {
    const existing = await port.findLogByExternalRef(input.externalRef);
    if (existing) {
      return { applied: false, skippedDuplicate: true, appliedChange: 0, entry: existing };
    }
  }
  const product = await port.getProduct(input.productId);
  if (!product) {
    throw new Error("Produkten finns inte längre.");
  }
  const variant = input.variantId ? product.variants?.find((item) => item.id === input.variantId) : undefined;
  if (input.variantId && !variant) {
    throw new Error("Storleken finns inte längre.");
  }
  const current = (variant ? variant.stock[input.storeId] : product.stock[input.storeId]) ?? 0;
  const { next, applied } = nextStockLevel(current, input.delta);
  const note =
    applied !== input.delta
      ? [input.note, `Begärt ${input.delta}, tillämpat ${applied}. Lagret kan inte gå under noll.`]
          .filter(Boolean)
          .join(" ")
      : input.note;
  const entry: StockLogEntry = {
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    storeId: input.storeId,
    productId: product.id,
    variantId: variant?.id,
    productName: variant ? `${product.name} – ${variant.label}` : product.name,
    change: applied,
    reason: input.reason,
    source: input.source,
    orderId: input.orderId,
    externalRef: input.externalRef,
    note,
  };
  if (applied === 0 && !input.externalRef) {
    return { applied: false, skippedDuplicate: false, appliedChange: 0, entry: null };
  }
  const variants = variant && product.variants
    ? product.variants.map((item) => item.id === variant.id ? { ...item, stock: { ...item.stock, [input.storeId]: next } } : item)
    : product.variants;
  const saved: Product = {
    ...product,
    variants,
    stock: variants?.length
      ? {
          fittja: variants.reduce((sum, item) => sum + (item.stock.fittja ?? 0), 0),
          marsta: variants.reduce((sum, item) => sum + (item.stock.marsta ?? 0), 0),
        }
      : { ...product.stock, [input.storeId]: next },
  };
  await port.saveProduct(saved);
  await port.addLog(entry);
  return { applied: applied !== 0, skippedDuplicate: false, appliedChange: applied, entry };
}

export type CommitFn = (input: StockMovementInput) => Promise<CommitResult>;

export async function applyOrderStock(commit: CommitFn, order: Order, shipFrom: StoreId): Promise<Order> {
  if (order.stockApplied || order.status === "klar") return order;
  const storeId: StoreId = order.fulfilment === "pickup" ? (order.pickupStoreId ?? shipFrom) : shipFrom;
  const generation = order.stockGeneration ?? 0;
  const deductions: Order["stockDeductions"] = [];
  for (const item of order.items) {
    const result = await commit({
      storeId,
      productId: item.productId,
      delta: -item.qty,
      reason: "online_order",
      source: "order",
      orderId: order.id,
      variantId: item.variantId,
      externalRef: `order:${order.id}:${generation}:${item.productId}:${item.variantId ?? ""}:${storeId}`,
      note: `Order ${order.number}`,
    });
    if (result.appliedChange < 0) {
      deductions.push({ productId: item.productId, variantId: item.variantId, storeId, qty: -result.appliedChange });
    }
  }
  return {
    ...order,
    status: "klar",
    stockApplied: true,
    shipFromStoreId: storeId,
    stockDeductions: deductions,
  };
}

export async function reverseOrderStock(commit: CommitFn, order: Order, nextStatus: Order["status"]): Promise<Order> {
  if (!order.stockApplied) {
    return { ...order, status: nextStatus };
  }
  const generation = order.stockGeneration ?? 0;
  for (const deduction of order.stockDeductions) {
    await commit({
      storeId: deduction.storeId,
      productId: deduction.productId,
      variantId: deduction.variantId,
      delta: deduction.qty,
      reason: "manual",
      source: "order",
      orderId: order.id,
      externalRef: `order-reversal:${order.id}:${generation}:${deduction.productId}:${deduction.variantId ?? ""}:${deduction.storeId}`,
      note: `Lager återfört från order ${order.number}`,
    });
  }
  return {
    ...order,
    status: nextStatus,
    stockApplied: false,
    stockGeneration: generation + 1,
    stockDeductions: [],
  };
}
