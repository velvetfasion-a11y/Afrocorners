import { describe, expect, it } from "vitest";
import { dateInStockholm, storeStatus, weeklyHoursSummary } from "../lib/hours";
import { applyOrderStock, commitMovement, reverseOrderStock, type InventoryPort } from "../lib/inventory";
import { buildOrderMessage, smsUrl, whatsappUrl } from "../lib/orders";
import { toE164 } from "../lib/format";
import { seedContent, seedProducts } from "../lib/seed";
import { parseSale, parseTransaction, saleIdFromClientTransaction } from "../lib/sumup/parse";
import { planSumupSync } from "../lib/sumup/plan";
import { homepageTiles, type Order, type Product, type StockLogEntry, type StockMovementInput } from "../lib/types";

function memory(products: Product[]) {
  const logs: StockLogEntry[] = [];
  const port: InventoryPort = {
    async getProduct(id) {
      return products.find((product) => product.id === id) ?? null;
    },
    async saveProduct(product) {
      const index = products.findIndex((item) => item.id === product.id);
      products[index] = product;
    },
    async findLogByExternalRef(ref) {
      return logs.find((entry) => entry.externalRef === ref) ?? null;
    },
    async addLog(entry) {
      logs.unshift(entry);
    },
  };
  return { port, logs, products, commit: (input: StockMovementInput) => commitMovement(port, input) };
}

const fittja = seedContent.stores[0];
const marsta = seedContent.stores[1];

describe("öppettider", () => {
  it("säger öppen nu under dagen i Fittja", () => {
    const status = storeStatus(fittja, dateInStockholm(2026, 11, 25, 15, 0));
    expect(status.open).toBe(true);
    expect(status.label).toBe("Öppen nu");
  });

  it("säger bara klockslag när butiken öppnar senare samma dag", () => {
    expect(storeStatus(fittja, dateInStockholm(2026, 11, 25, 8, 0)).label).toBe("Öppnar kl 10:00");
  });

  it("tar med veckodag när öppningen inte är i dag", () => {
    expect(storeStatus(fittja, dateInStockholm(2026, 11, 25, 21, 0)).label).toBe("Öppnar torsdag kl 10:00");
  });

  it("hoppar över söndag i Märsta och säger aldrig stängt", () => {
    const label = storeStatus(marsta, dateInStockholm(2026, 11, 29, 12, 0)).label;
    expect(label).toBe("Öppnar måndag kl 10:00");
    expect(label.toLowerCase()).not.toContain("stängt");
  });

  it("har Fittja öppet söndag mitt på dagen", () => {
    expect(storeStatus(fittja, dateInStockholm(2026, 11, 29, 12, 0)).label).toBe("Öppen nu");
  });

  it("räknar lördag i Märsta som slut efter 16:00", () => {
    expect(storeStatus(marsta, dateInStockholm(2026, 11, 28, 16, 30)).label).toBe("Öppnar måndag kl 10:00");
  });

  it("hoppar över en extra ledig dag", () => {
    const closed = { ...fittja, closedDates: ["2026-11-26"] };
    expect(storeStatus(closed, dateInStockholm(2026, 11, 25, 21, 0)).label).toBe("Öppnar fredag kl 10:00");
  });

  it("sammanfattar veckan som Mån–Fre, Lör och Sön", () => {
    expect(weeklyHoursSummary(fittja.hours)).toEqual([
      { label: "Mån–Fre", hours: "10:00–20:00" },
      { label: "Lör", hours: "10:00–17:00" },
      { label: "Sön", hours: "11:00–16:00" },
    ]);
    expect(weeklyHoursSummary(marsta.hours)).toEqual([
      { label: "Mån–Fre", hours: "10:00–18:30" },
      { label: "Lör", hours: "10:00–16:00" },
      { label: "Sön", hours: "Stängt" },
    ]);
  });

  it("slår inte ihop dagar med olika tider", () => {
    const hours = {
      ...fittja.hours,
      wed: { open: "12:00", close: "16:00" },
    };
    expect(weeklyHoursSummary(hours).map((span) => span.label)).toEqual(["Mån–Tis", "Ons", "Tor–Fre", "Lör", "Sön"]);
  });
});

describe("startsidans kategorier", () => {
  it("visar bara hårvård, mat och nyheter, i den ordningen", () => {
    const tiles = homepageTiles(seedContent.categories);
    expect(tiles.map((tile) => tile.name)).toEqual(["Hårvård", "Mat & Specerier", "Nyheter"]);
    expect(seedContent.categories.map((tile) => tile.name)).toEqual([
      "Hårvård",
      "Skönhet",
      "Mat & Specerier",
      "Kultur & Hem",
      "Accessoarer",
      "Nyheter",
    ]);
  });
});

describe("lager", () => {
  it("drar bara en gång när samma externa id kommer igen", async () => {
    const db = memory(structuredClone(seedProducts));
    const input: StockMovementInput = {
      storeId: "fittja",
      productId: "braids",
      delta: -1,
      reason: "SumUp-försäljning",
      source: "sumup",
      externalRef: "sumup:sale:M1:sale:line",
    };
    await db.commit(input);
    await db.commit(input);
    expect(db.products.find((product) => product.id === "braids")?.stock.fittja).toBe(7);
    expect(db.logs).toHaveLength(1);
    expect(db.logs[0].reason).toBe("SumUp-försäljning");
  });

  it("går inte under noll", async () => {
    const db = memory(structuredClone(seedProducts));
    const result = await db.commit({ storeId: "marsta", productId: "berbere", delta: -3, reason: "in_store_sale", source: "admin" });
    expect(result.appliedChange).toBe(0);
    expect(db.products.find((product) => product.id === "berbere")?.stock.marsta).toBe(0);
  });

  it("minskar rätt butik när ordern blir klar och lägger tillbaka vid avbokning", async () => {
    const db = memory(structuredClone(seedProducts));
    const order: Order = {
      id: "o1",
      number: "AC-1",
      createdAt: new Date().toISOString(),
      status: "betald",
      fulfilment: "pickup",
      pickupStoreId: "marsta",
      shipFromStoreId: null,
      customer: { name: "Nora", phone: "0701234567", address: "", postalCode: "", city: "" },
      items: [{ productId: "soap", name: "Afrikansk Svarttvål", qty: 2, unitPrice: 59, image: "/images/prod-soap.jpg" }],
      total: 118,
      stockApplied: false,
      stockGeneration: 0,
      stockDeductions: [],
      note: "",
    };
    const done = await applyOrderStock(db.commit, order, "fittja");
    expect(db.products.find((product) => product.id === "soap")?.stock.marsta).toBe(7);
    const again = await applyOrderStock(db.commit, done, "fittja");
    expect(again.stockApplied).toBe(true);
    expect(db.products.find((product) => product.id === "soap")?.stock.marsta).toBe(7);
    await reverseOrderStock(db.commit, done, "avbruten");
    expect(db.products.find((product) => product.id === "soap")?.stock.marsta).toBe(9);
  });
});

describe("ordertext", () => {
  it("tar med antal, pris, bildlänk, total och ordernummer", () => {
    const order: Order = {
      id: "o2",
      number: "AC-261126-1001",
      createdAt: new Date().toISOString(),
      status: "ny",
      fulfilment: "delivery",
      pickupStoreId: null,
      shipFromStoreId: null,
      customer: { name: "Amina Hassan", phone: "0701112233", address: "Storgatan 1", postalCode: "145 51", city: "Norsborg" },
      items: [{ productId: "braids", name: "Mörkbruna Box Braids", qty: 2, unitPrice: 279, image: "/images/prod-braids.jpg" }],
      total: 558,
      stockApplied: false,
      stockGeneration: 0,
      stockDeductions: [],
      note: "",
    };
    const text = buildOrderMessage({
      template: seedContent.messageTemplate,
      order,
      origin: "https://afrocorner.se",
      stores: seedContent.stores,
      freeShippingThreshold: 499,
    });
    expect(text).toContain("Mörkbruna Box Braids");
    expect(text).toContain("2 st");
    expect(text).toContain("558");
    expect(text).toContain("https://afrocorner.se/images/prod-braids.jpg");
    expect(text).toContain("AC-261126-1001");
    expect(text).toContain("Hemleverans");
    expect(text).toContain("Fri frakt");
    expect(text).toContain("Amina Hassan");
    expect(whatsappUrl("0705508554", text)).toContain("https://wa.me/46705508554?text=");
    expect(smsUrl("+46 70 550 85 54", "Hej")).toContain("sms:+46705508554?&body=");
  });

  it("gör om svenska mobilnummer till 46", () => {
    expect(toE164("070-550 85 54")).toBe("46705508554");
    expect(toE164("+46 70 550 85 54")).toBe("46705508554");
    expect(toE164("0046705508554")).toBe("46705508554");
  });
});

describe("SumUp", () => {
  const products = [{ id: "braids", name: "Mörkbruna Box Braids", sku: "BRAID-BROWN" }];
  const locations = [{ kind: "merchant" as const, externalId: "MFITTJA", storeId: "fittja" as const }];

  it("matchar SKU och drar från rätt butik", () => {
    const plan = planSumupSync({
      lines: [{ merchantCode: "MFITTJA", saleId: "s1", lineId: "l1", type: "CATALOG", name: "Box braids", quantity: 2, unitId: "each", sku: "braid-brown", catalogReference: "", operation: "sale" }],
      refunds: [],
      barePayments: [],
      applied: [],
      products,
      mappings: [],
      locations,
      now: "2026-11-26T10:00:00.000Z",
    });
    expect(plan.intents).toEqual([
      expect.objectContaining({ productId: "braids", storeId: "fittja", delta: -2, reason: "SumUp-försäljning", externalRef: "sumup:sale:MFITTJA:s1:l1" }),
    ]);
  });

  it("lägger omatchade varor i kön och rör inte lagret", () => {
    const plan = planSumupSync({
      lines: [{ merchantCode: "MFITTJA", saleId: "s2", lineId: "l1", type: "CUSTOM", name: "Okänd olja", quantity: 1, unitId: "each", sku: "", catalogReference: "", operation: "sale" }],
      refunds: [],
      barePayments: [],
      applied: [],
      products,
      mappings: [],
      locations,
    });
    expect(plan.intents).toHaveLength(0);
    expect(plan.pending[0].kind).toBe("unmatched_product");
  });

  it("lägger tillbaka lagret vid en full retur och ignorerar avgifter", () => {
    const plan = planSumupSync({
      lines: [
        { merchantCode: "MFITTJA", saleId: "s3", lineId: "fee", type: "FEE", name: "Dricks", quantity: 1, unitId: "each", sku: "", catalogReference: "", operation: "sale" },
        { merchantCode: "MFITTJA", saleId: "s3", lineId: "l1", type: "CATALOG", name: "Mörkbruna Box Braids", quantity: 1, unitId: "each", sku: "", catalogReference: "", operation: "return" },
      ],
      refunds: [{ merchantCode: "MFITTJA", transactionId: "t1", amount: 279, refundedAmount: 279, linkedSaleId: "s3" }],
      barePayments: [],
      applied: [],
      products,
      mappings: [],
      locations,
    });
    expect(plan.intents).toHaveLength(1);
    expect(plan.intents[0]).toEqual(expect.objectContaining({ delta: 1, reason: "SumUp-retur", externalRef: "sumup:return:MFITTJA:s3:l1" }));
  });

  it("återför en full retur av en försäljning i samma synk utan att dubblera", () => {
    const plan = planSumupSync({
      lines: [{ merchantCode: "MFITTJA", saleId: "s4", lineId: "l1", type: "CATALOG", name: "Mörkbruna Box Braids", quantity: 2, unitId: "each", sku: "BRAID-BROWN", catalogReference: "", operation: "sale" }],
      refunds: [{ merchantCode: "MFITTJA", transactionId: "t9", amount: 558, refundedAmount: 558, linkedSaleId: "s4" }],
      barePayments: [],
      applied: [],
      products,
      mappings: [],
      locations,
    });
    expect(plan.intents.map((intent) => intent.delta).sort()).toEqual([-2, 2]);
    const again = planSumupSync({
      lines: [{ merchantCode: "MFITTJA", saleId: "s4", lineId: "l1", type: "CATALOG", name: "Mörkbruna Box Braids", quantity: 2, unitId: "each", sku: "BRAID-BROWN", catalogReference: "", operation: "sale" }],
      refunds: [],
      barePayments: [],
      applied: [],
      products,
      mappings: [],
      locations,
    });
    expect(again.intents[0].externalRef).toBe(plan.intents.find((intent) => intent.delta < 0)?.externalRef);
  });

  it("köar delvisa returer och belopp utan varurader", () => {
    const plan = planSumupSync({
      lines: [],
      refunds: [{ merchantCode: "MFITTJA", transactionId: "t2", amount: 100, refundedAmount: 40, linkedSaleId: "s9" }],
      barePayments: [{ merchantCode: "MFITTJA", transactionId: "p1", summary: "", amount: 80, currency: "SEK" }],
      applied: [],
      products,
      mappings: [],
      locations,
    });
    expect(plan.intents).toHaveLength(0);
    expect(plan.pending.map((item) => item.kind).sort()).toEqual(["amount_only", "partial_refund"]);
  });

  it("läser SKU och retur från SumUps svarsformat", () => {
    const lines = parseSale("MFITTJA", {
      id: "sale-1",
      items: [{
        id: "line-1",
        type: "CATALOG",
        name: "Cappuccino",
        quantity: 2,
        unit_of_measure: { unit_id: "each" },
        references: { sku: "COFFEE-LARGE", catalog_reference: "urn:sumup:pos:variant:M:1:2" },
        features: [{ name: "operation_type", value: "SALE" }],
      }],
      payments: [{ reference: "TERTYFQ4G3", type: "purchase", status: "SUCCESSFUL" }],
    });
    expect(lines[0].sku).toBe("COFFEE-LARGE");
    expect(lines[0].operation).toBe("sale");
    expect(saleIdFromClientTransaction("urn:sumup:pos:sale:MFITTJA:5965aa65-e45a-4cc1-9063-c1c1e3b8607f;2")).toBe("5965aa65-e45a-4cc1-9063-c1c1e3b8607f");
    const refund = parseTransaction("MFITTJA", {
      id: "tx1",
      transaction_code: "TEENSK4W2K",
      status: "REFUNDED",
      type: "PAYMENT",
      payment_type: "POS",
      amount: 10,
      refunded_amount: 10,
      client_transaction_id: "urn:sumup:pos:sale:MFITTJA:5965aa65-e45a-4cc1-9063-c1c1e3b8607f",
    });
    expect(refund.refund?.linkedSaleId).toBe("5965aa65-e45a-4cc1-9063-c1c1e3b8607f");
    expect(refund.refund?.refundedAmount).toBe(10);
  });
});
