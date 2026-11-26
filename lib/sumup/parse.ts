import type { BarePayment, PlanLine, PlanRefund } from "./plan";

interface Feature {
  name?: string;
  value?: string;
}

interface SaleItem {
  id?: string;
  type?: string;
  name?: string;
  quantity?: number;
  unit_of_measure?: { unit_id?: string };
  references?: { sku?: string; catalog_reference?: string };
  features?: Feature[];
}

interface SalePayment {
  reference?: string;
  type?: string;
  status?: string;
}

export interface SaleRecord {
  id?: string;
  items?: SaleItem[];
  payments?: SalePayment[];
  reader_id?: string;
  terminal_id?: string;
  source?: { reader_id?: string; terminal_id?: string; device_id?: string; channel?: string };
}

export interface TransactionRecord {
  id?: string;
  transaction_id?: string;
  transaction_code?: string;
  merchant_code?: string;
  amount?: number;
  refunded_amount?: number;
  currency?: string;
  status?: string;
  type?: string;
  payment_type?: string;
  product_summary?: string;
  client_transaction_id?: string;
  timestamp?: string;
}

export function saleIdFromClientTransaction(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.match(/urn:sumup:pos:sale:[^:]+:([0-9a-f-]{36})/i);
  return match?.[1];
}

function operationOf(item: SaleItem, sale: SaleRecord): "sale" | "return" {
  const feature = item.features?.find((entry) => entry.name === "operation_type")?.value?.toUpperCase();
  if (feature === "RETURN") return "return";
  const refundPayment = (sale.payments ?? []).some(
    (payment) => payment.type === "unreferenced_refund" && payment.status === "SUCCESSFUL",
  );
  return refundPayment ? "return" : "sale";
}

function readerIdOf(sale: SaleRecord): string | undefined {
  return sale.reader_id || sale.terminal_id || sale.source?.reader_id || sale.source?.terminal_id || sale.source?.device_id;
}

export function parseSale(merchantCode: string, sale: SaleRecord): PlanLine[] {
  const readerId = readerIdOf(sale);
  return (sale.items ?? []).map((item, index) => ({
    merchantCode,
    saleId: sale.id || "unknown-sale",
    lineId: item.id || `line-${index + 1}`,
    type: item.type || "CUSTOM",
    name: item.name || "Vara",
    quantity: Number(item.quantity ?? 0),
    unitId: item.unit_of_measure?.unit_id || "each",
    sku: item.references?.sku || "",
    catalogReference: item.references?.catalog_reference || "",
    operation: operationOf(item, sale),
    readerId,
  }));
}

export function paymentReferences(sale: SaleRecord): string[] {
  return (sale.payments ?? []).map((payment) => payment.reference).filter((reference): reference is string => Boolean(reference));
}

export interface ParsedTransaction {
  id: string;
  code?: string;
  merchantCode: string;
  refund?: PlanRefund;
  bare?: BarePayment;
  saleLink?: string;
  inStore: boolean;
}

const IN_STORE_TYPES = new Set(["POS", "CASH", "UNKNOWN", ""]);

export function parseTransaction(merchantCode: string, tx: TransactionRecord): ParsedTransaction {
  const id = tx.id || tx.transaction_id || tx.transaction_code || "unknown";
  const paymentType = tx.payment_type || "";
  const inStore = IN_STORE_TYPES.has(paymentType);
  const saleLink = saleIdFromClientTransaction(tx.client_transaction_id);
  const refundedAmount = tx.type === "REFUND" ? Number(tx.amount ?? 0) : Number(tx.refunded_amount ?? 0);
  const isRefund = tx.status === "REFUNDED" || tx.type === "REFUND" || refundedAmount > 0;
  const parsed: ParsedTransaction = { id, code: tx.transaction_code, merchantCode: tx.merchant_code || merchantCode, saleLink, inStore };
  if (isRefund && (inStore || saleLink)) {
    parsed.refund = {
      merchantCode: parsed.merchantCode,
      transactionId: id,
      amount: Number(tx.amount ?? 0),
      refundedAmount: refundedAmount > 0 ? refundedAmount : Number(tx.amount ?? 0),
      linkedSaleId: saleLink,
    };
  } else if (tx.status === "SUCCESSFUL" && tx.type !== "REFUND" && inStore) {
    parsed.bare = {
      merchantCode: parsed.merchantCode,
      transactionId: id,
      summary: tx.product_summary || "",
      amount: Number(tx.amount ?? 0),
      currency: tx.currency || "SEK",
    };
  }
  return parsed;
}
