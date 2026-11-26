import "server-only";

import { applyMovement, readDatabase, saveSumupState } from "../server/db";
import { listConnections, type SumupConnection } from "../server/secrets";
import type { AppliedSaleLine } from "./plan";
import { planSumupSync } from "./plan";
import { parseSale, parseTransaction, paymentReferences, type SaleRecord } from "./parse";
import { getSale, listTransactions, searchSales, SumUpError } from "./client";
import type { SumupPending, SumupState } from "../types";

export interface SyncReport {
  configured: boolean;
  skipped: boolean;
  applied: number;
  duplicates: number;
  pending: number;
  message: string;
}

function merchantCodes(connection: SumupConnection): string[] {
  const codes = [connection.merchantCode, ...connection.extraMerchantCodes].map((code) => code.trim()).filter(Boolean);
  return [...new Set(codes)];
}

function mergePending(existing: SumupPending[], fresh: SumupPending[], resolvedIds: Set<string>): SumupPending[] {
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const id of resolvedIds) map.delete(id);
  for (const item of fresh) map.set(item.id, item);
  return [...map.values()].slice(0, 200);
}

export async function syncSumup(): Promise<SyncReport> {
  const connections = await listConnections();
  const db = await readDatabase();
  if (connections.length === 0 || connections.every((connection) => merchantCodes(connection).length === 0 && connection.authType !== "api_key")) {
    if (connections.length === 0) {
      return { configured: false, skipped: true, applied: 0, duplicates: 0, pending: db.sumup.pending.length, message: "SumUp är inte anslutet." };
    }
  }
  if (connections.length === 0) {
    return { configured: false, skipped: true, applied: 0, duplicates: 0, pending: 0, message: "SumUp är inte anslutet." };
  }

  let applied = 0;
  let duplicates = 0;
  const errors: string[] = [];
  let sumup = db.sumup;
  const resolved = new Set<string>();
  const freshPending: SumupPending[] = [];

  for (const connection of connections) {
    let codes = merchantCodes(connection);
    if (codes.length === 0 && connection.apiKey) {
      try {
        const { sumupMe } = await import("./client");
        const me = await sumupMe(connection);
        connection.merchantCode = me.merchantCode;
        connection.merchantName = me.merchantName;
        codes = [me.merchantCode];
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Kunde inte läsa SumUp-kontot.");
        continue;
      }
    }
    for (const merchantCode of codes) {
      try {
        const result = await syncMerchant(connection, merchantCode, sumup, db.logs);
        applied += result.applied;
        duplicates += result.duplicates;
        freshPending.push(...result.pending);
        for (const id of result.resolvedIds) resolved.add(id);
        sumup = { ...sumup, lastSyncAt: result.cursor };
      } catch (error) {
        const message = error instanceof SumUpError ? error.message : error instanceof Error ? error.message : "Synken misslyckades.";
        errors.push(`${merchantCode}: ${message}`);
      }
    }
  }

  const next: SumupState = {
    ...sumup,
    pending: mergePending(sumup.pending, freshPending, resolved),
    lastSummary: errors.length
      ? `Delvis synk. ${applied} lagerrader, ${duplicates} dubbletter hoppades över.`
      : `Synk klar. ${applied} lagerrader, ${duplicates} redan räknade.`,
    lastError: errors[0] ?? null,
  };
  await saveSumupState(next);
  return {
    configured: true,
    skipped: false,
    applied,
    duplicates,
    pending: next.pending.length,
    message: next.lastError ? `${next.lastSummary} Fel: ${next.lastError}` : next.lastSummary,
  };
}

async function syncMerchant(
  connection: SumupConnection,
  merchantCode: string,
  sumup: SumupState,
  logs: { externalRef?: string; productId: string; productName: string; storeId: "fittja" | "marsta"; change: number }[],
) {
  const database = await readDatabase();
  const from = sumup.lastSyncAt
    ? new Date(Math.max(new Date(sumup.syncFrom).getTime(), new Date(sumup.lastSyncAt).getTime() - 24 * 60 * 60 * 1000)).toISOString()
    : sumup.syncFrom;
  const changesSince = sumup.lastSyncAt
    ? new Date(new Date(sumup.lastSyncAt).getTime() - 10 * 60 * 1000).toISOString()
    : sumup.syncFrom;

  const saleIds: string[] = [];
  let token: string | undefined;
  for (let page = 0; page < 8; page += 1) {
    const pageResult = await searchSales(connection, merchantCode, from, sumup.channels.length ? sumup.channels : ["POS", "SOLO", "KIOSK"], token);
    saleIds.push(...pageResult.ids);
    if (!pageResult.next) break;
    token = pageResult.next;
  }

  const sales: SaleRecord[] = [];
  for (const id of saleIds) {
    sales.push(await getSale(connection, merchantCode, id));
  }
  const covered = new Set<string>();
  for (const sale of sales) {
    for (const reference of paymentReferences(sale)) covered.add(reference);
  }

  const transactions = await listTransactions(connection, merchantCode, changesSince);
  const lines = sales.flatMap((sale) => parseSale(merchantCode, sale));
  const refunds = [];
  const bare = [];
  for (const tx of transactions) {
    const parsed = parseTransaction(merchantCode, tx);
    if (parsed.refund) {
      if (!parsed.refund.linkedSaleId && parsed.code && covered.has(parsed.code)) {
        const sale = sales.find((item) => paymentReferences(item).includes(parsed.code as string));
        parsed.refund.linkedSaleId = sale?.id;
      }
      refunds.push(parsed.refund);
    } else if (parsed.bare && parsed.code && !covered.has(parsed.code) && !parsed.saleLink) {
      bare.push(parsed.bare);
    }
  }

  const applied: AppliedSaleLine[] = [];
  for (const entry of logs) {
    const ref = entry.externalRef ?? "";
    const match = ref.match(/^sumup:sale:([^:]+):([^:]+):([^:]+)$/);
    if (!match || match[1] !== merchantCode || entry.change >= 0) continue;
    applied.push({
      merchantCode,
      saleId: match[2],
      lineId: match[3],
      productId: entry.productId,
      productName: entry.productName,
      storeId: entry.storeId,
      qty: -entry.change,
    });
  }

  const plan = planSumupSync({
    lines,
    refunds,
    barePayments: bare,
    applied,
    products: database.products.filter((product) => product.active).map((product) => ({ id: product.id, name: product.name, sku: product.sku })),
    mappings: sumup.productMappings,
    locations: sumup.locationMappings,
  });

  let appliedCount = 0;
  let duplicates = 0;
  const resolvedIds = new Set<string>();
  for (const intent of plan.intents) {
    const result = await applyMovement(intent);
    if (result.skippedDuplicate) duplicates += 1;
    else if (result.appliedChange !== 0 || result.entry) appliedCount += 1;
    const ref = intent.externalRef ?? "";
    const saleMatch = ref.match(/^sumup:(?:sale|return):([^:]+):([^:]+):([^:]+)/);
    if (saleMatch) resolvedIds.add(`pending:${saleMatch[1]}:${saleMatch[2]}:${saleMatch[3]}`);
  }

  return { applied: appliedCount, duplicates, pending: plan.pending, resolvedIds, cursor: new Date().toISOString() };
}
