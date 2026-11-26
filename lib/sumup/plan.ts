import { normalizeName } from "../format";
import type { StockMovementInput, StoreId, SumupPending, SumupPendingKind } from "../types";

export interface PlanProduct {
  id: string;
  name: string;
  sku: string;
}

export interface PlanMapping {
  key: string;
  productId: string;
}

export interface PlanLocation {
  kind: "merchant" | "reader";
  externalId: string;
  storeId: StoreId | "";
}

export interface PlanLine {
  merchantCode: string;
  saleId: string;
  lineId: string;
  type: string;
  name: string;
  quantity: number;
  unitId: string;
  sku: string;
  catalogReference: string;
  operation: "sale" | "return";
  readerId?: string;
}

export interface PlanRefund {
  merchantCode: string;
  transactionId: string;
  amount: number;
  refundedAmount: number;
  linkedSaleId?: string;
}

export interface AppliedSaleLine {
  merchantCode: string;
  saleId: string;
  lineId: string;
  productId: string;
  productName: string;
  storeId: StoreId;
  qty: number;
}

export interface BarePayment {
  merchantCode: string;
  transactionId: string;
  summary: string;
  amount: number;
  currency: string;
}

export interface StockIntent extends StockMovementInput {
  productName: string;
}

export interface PlanResult {
  intents: StockIntent[];
  pending: SumupPending[];
}

const SKIP_TYPES = new Set(["FEE", "GIFT_CARD", "DEPOSIT"]);

export function pieceCount(quantity: number, unitId: string): { pieces: number } | { weight: true } {
  if (!Number.isFinite(quantity) || quantity <= 0) return { pieces: 0 };
  const unit = unitId.toLowerCase();
  const fractional = Math.abs(quantity - Math.round(quantity)) > 0.001;
  if ((unit.startsWith("weight") || unit.startsWith("volume")) && fractional) return { weight: true };
  return { pieces: Math.max(0, Math.round(quantity)) };
}

export function resolveStore(merchantCode: string, readerId: string | undefined, locations: PlanLocation[]): StoreId | null {
  if (readerId) {
    const reader = locations.find(
      (item) => item.kind === "reader" && item.externalId === readerId && (item.storeId === "fittja" || item.storeId === "marsta"),
    );
    if (reader?.storeId === "fittja" || reader?.storeId === "marsta") return reader.storeId;
  }
  const merchant = locations.find(
    (item) =>
      item.kind === "merchant" && item.externalId === merchantCode && (item.storeId === "fittja" || item.storeId === "marsta"),
  );
  if (merchant?.storeId === "fittja" || merchant?.storeId === "marsta") return merchant.storeId;
  return null;
}

export function matchProduct(line: Pick<PlanLine, "sku" | "name" | "catalogReference">, products: PlanProduct[], mappings: PlanMapping[]): PlanProduct | null {
  const sku = normalizeName(line.sku);
  const name = normalizeName(line.name);
  const catalog = line.catalogReference.trim();
  const mapped = (key: string) => {
    const id = mappings.find((item) => item.key === key)?.productId;
    return id ? products.find((product) => product.id === id) ?? null : null;
  };
  return (
    (catalog ? mapped(`catalog:${catalog}`) : null) ||
    (sku ? mapped(`sku:${sku}`) : null) ||
    (name ? mapped(`name:${name}`) : null) ||
    (sku ? products.find((product) => normalizeName(product.sku) === sku) ?? null : null) ||
    (name ? products.find((product) => normalizeName(product.name) === name) ?? null : null)
  );
}

function pendingBase(line: PlanLine, kind: SumupPendingKind, detail: string, storeId: StoreId | null, now: string): SumupPending {
  return {
    id: `pending:${line.merchantCode}:${line.saleId}:${line.lineId}`,
    merchantCode: line.merchantCode,
    saleId: line.saleId,
    lineId: line.lineId,
    name: line.name,
    sku: line.sku,
    quantity: line.quantity,
    storeId,
    kind,
    detail,
    createdAt: now,
  };
}

export function planSumupSync(input: {
  lines: PlanLine[];
  refunds: PlanRefund[];
  barePayments: BarePayment[];
  applied: AppliedSaleLine[];
  products: PlanProduct[];
  mappings: PlanMapping[];
  locations: PlanLocation[];
  now?: string;
}): PlanResult {
  const now = input.now ?? new Date().toISOString();
  const intents: StockIntent[] = [];
  const pending: SumupPending[] = [];
  const returnSales = new Set<string>();
  const justSold: AppliedSaleLine[] = [];

  for (const line of input.lines) {
    if (SKIP_TYPES.has(line.type)) continue;
    const storeId = resolveStore(line.merchantCode, line.readerId, input.locations);
    if (!storeId) {
      pending.push(pendingBase(line, "unmapped_store", "Koppla SumUp-kontot till Fittja eller Märsta.", null, now));
      continue;
    }
    const pieces = pieceCount(line.quantity, line.unitId);
    if ("weight" in pieces) {
      pending.push(pendingBase(line, "weight", "Vikt- eller volymvara. Justera lagret för hand.", storeId, now));
      continue;
    }
    if (pieces.pieces <= 0) continue;
    const product = matchProduct(line, input.products, input.mappings);
    if (!product) {
      pending.push(
        pendingBase(line, "unmatched_product", "Ingen produkt matchade SKU eller namn. Koppla den manuellt.", storeId, now),
      );
      continue;
    }
    const returning = line.operation === "return";
    if (returning) returnSales.add(`${line.merchantCode}:${line.saleId}`);
    else {
      justSold.push({
        merchantCode: line.merchantCode,
        saleId: line.saleId,
        lineId: line.lineId,
        productId: product.id,
        productName: product.name,
        storeId,
        qty: pieces.pieces,
      });
    }
    intents.push({
      storeId,
      productId: product.id,
      productName: product.name,
      delta: returning ? pieces.pieces : -pieces.pieces,
      reason: returning ? "SumUp-retur" : "SumUp-försäljning",
      source: "sumup",
      externalRef: returning
        ? `sumup:return:${line.merchantCode}:${line.saleId}:${line.lineId}`
        : `sumup:sale:${line.merchantCode}:${line.saleId}:${line.lineId}`,
      note: `SumUp ${line.saleId}`,
    });
  }

  for (const refund of input.refunds) {
    if (!(refund.refundedAmount > 0)) continue;
    const full = refund.amount > 0 && refund.refundedAmount + 0.009 >= refund.amount;
    const id = `pending:refund:${refund.merchantCode}:${refund.transactionId}`;
    if (!full || !refund.linkedSaleId) {
      pending.push({
        id,
        merchantCode: refund.merchantCode,
        saleId: refund.linkedSaleId ?? "",
        lineId: refund.transactionId,
        name: "Delvis retur",
        sku: "",
        quantity: 0,
        storeId: resolveStore(refund.merchantCode, undefined, input.locations),
        kind: "partial_refund",
        detail: "SumUp angav ingen varurad för returen. Lägg tillbaka lagret under Lager.",
        createdAt: now,
      });
      continue;
    }
    if (returnSales.has(`${refund.merchantCode}:${refund.linkedSaleId}`)) continue;
    const applied = [...input.applied, ...justSold].filter(
      (line) => line.merchantCode === refund.merchantCode && line.saleId === refund.linkedSaleId,
    );
    if (applied.length === 0) {
      pending.push({
        id,
        merchantCode: refund.merchantCode,
        saleId: refund.linkedSaleId,
        lineId: refund.transactionId,
        name: "Retur",
        sku: "",
        quantity: 0,
        storeId: resolveStore(refund.merchantCode, undefined, input.locations),
        kind: "partial_refund",
        detail: "Returen hör till en försäljning som inte drogs från lagret här.",
        createdAt: now,
      });
      continue;
    }
    for (const line of applied) {
      intents.push({
        storeId: line.storeId,
        productId: line.productId,
        productName: line.productName,
        delta: line.qty,
        reason: "SumUp-retur",
        source: "sumup",
        externalRef: `sumup:refund:${refund.merchantCode}:${refund.transactionId}:${line.lineId}`,
        note: `SumUp-retur ${refund.transactionId}`,
      });
    }
  }

  for (const payment of input.barePayments) {
    pending.push({
      id: `pending:amount:${payment.merchantCode}:${payment.transactionId}`,
      merchantCode: payment.merchantCode,
      saleId: "",
      lineId: payment.transactionId,
      name: payment.summary.trim() || "Kortköp utan varor",
      sku: "",
      quantity: 0,
      storeId: resolveStore(payment.merchantCode, undefined, input.locations),
      kind: "amount_only",
      detail: `${payment.amount} ${payment.currency}. SumUp skickade inga varurader, så lagret ändras inte. Registrera varorna under Sålt i butik.`,
      createdAt: now,
    });
  }

  return { intents, pending };
}

/** Turn a saved manual mapping into a stock movement for one waiting line. */
export function intentFromMappedPending(item: SumupPending, product: PlanProduct, pieces: number): StockIntent | null {
  if (!item.storeId || pieces <= 0) return null;
  if (item.kind !== "unmatched_product" && item.kind !== "weight") return null;
  const returning = item.detail.toLowerCase().includes("retur");
  return {
    storeId: item.storeId,
    productId: product.id,
    productName: product.name,
    delta: returning ? pieces : -pieces,
    reason: returning ? "SumUp-retur" : "SumUp-försäljning",
    source: "sumup",
    externalRef: `sumup:map:${item.merchantCode}:${item.saleId}:${item.lineId}:${product.id}`,
    note: `Manuell koppling av ${item.name}`,
  };
}
