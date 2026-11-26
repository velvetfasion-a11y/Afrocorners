import { describe, expect, it } from "vitest";
import { buildOrderMessage } from "../lib/orders";
import {
  accountAgeDays,
  defaultOffers,
  eligibleOffers,
  mergeFavorites,
  normalizeOffers,
  pickOffer,
  type CustomerProfile,
  type ShopOffer,
} from "../lib/offers";
import { seedContent } from "../lib/seed";
import type { Order } from "../lib/types";

const today = "2026-11-26";

function customer(partial: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    uid: "uid-1",
    email: "kund@example.com",
    name: "Amina",
    favorites: [],
    createdAt: "2026-11-26T08:00:00.000Z",
    firstOrderAt: null,
    orderCount: 0,
    ...partial,
  };
}

function withOffer(kind: ShopOffer["kind"], partial: Partial<ShopOffer>): ShopOffer[] {
  return normalizeOffers(defaultOffers().map((offer) => offer.kind === kind ? { ...offer, enabled: true, ...partial } : offer));
}

describe("rabatter", () => {
  it("ger nya kunder procent på första ordern", () => {
    const offers = withOffer("new_customer", { unit: "percent", amount: 10 });
    const deal = pickOffer(offers, customer(), 200, today);
    expect(deal?.discount).toBe(20);
    expect(deal?.offerId).toBe("new_customer");
  });

  it("ger inte nykundsrabatt när det redan finns en order", () => {
    const offers = withOffer("new_customer", { unit: "percent", amount: 10 });
    expect(pickOffer(offers, customer({ orderCount: 1, firstOrderAt: "2026-11-20T08:00:00.000Z" }), 200, today)).toBeNull();
  });

  it("ger kronor till kunder vars konto är minst 7 dagar", () => {
    const offers = withOffer("loyal", { unit: "kr", amount: 50, minAccountDays: 7 });
    const createdAt = "2026-11-19T10:00:00.000Z";
    expect(accountAgeDays(createdAt, today)).toBe(7);
    const deal = pickOffer(offers, customer({ createdAt, orderCount: 2 }), 300, today);
    expect(deal?.discount).toBe(50);
  });

  it("väntar ut minsta antal dagar", () => {
    const offers = withOffer("loyal", { unit: "kr", amount: 50, minAccountDays: 7 });
    const createdAt = "2026-11-20T10:00:00.000Z";
    expect(accountAgeDays(createdAt, today)).toBe(6);
    expect(pickOffer(offers, customer({ createdAt }), 300, today)).toBeNull();
  });

  it("räknar kontots ålder i Stockholm", () => {
    expect(accountAgeDays("2026-11-19T23:30:00.000Z", today)).toBe(6);
  });

  it("ger inloggade antingen procent eller kronor", () => {
    const percent = withOffer("everyone", { unit: "percent", amount: 10 });
    expect(pickOffer(percent, customer({ orderCount: 3 }), 250, today)?.discount).toBe(25);
    const kronor = withOffer("everyone", { unit: "kr", amount: 40 });
    expect(pickOffer(kronor, customer({ orderCount: 3 }), 250, today)?.discount).toBe(40);
  });

  it("kräver minsta order och håller sig inom datum", () => {
    const offers = withOffer("everyone", { unit: "kr", amount: 30, minOrder: 400, startsOn: "2026-11-01", endsOn: "2026-11-30" });
    const person = customer({ orderCount: 1 });
    expect(pickOffer(offers, person, 399, today)).toBeNull();
    expect(pickOffer(offers, person, 400, today)?.discount).toBe(30);
    expect(pickOffer(offers, person, 400, "2026-12-01")).toBeNull();
    expect(eligibleOffers(offers, person, today)).toHaveLength(1);
  });

  it("hoppar över avstängda erbjudanden", () => {
    const offers = normalizeOffers(defaultOffers());
    expect(pickOffer(offers, customer(), 500, today)).toBeNull();
  });

  it("väljer den största rabatten och staplar inte", () => {
    const offers = normalizeOffers([
      { id: "new_customer", kind: "new_customer", enabled: true, unit: "percent", amount: 10 },
      { id: "everyone", kind: "everyone", enabled: true, unit: "kr", amount: 50 },
    ]);
    const deal = pickOffer(offers, customer(), 200, today);
    expect(deal?.discount).toBe(50);
    expect(deal?.offerId).toBe("everyone");
  });

  it("drar aldrig mer än ordervärdet", () => {
    const offers = withOffer("loyal", { unit: "kr", amount: 500, minAccountDays: 0 });
    const deal = pickOffer(offers, customer({ createdAt: "2026-01-01T00:00:00.000Z" }), 120, today);
    expect(deal?.discount).toBe(120);
  });

  it("ger inget utan konto", () => {
    const offers = withOffer("everyone", { unit: "percent", amount: 50 });
    expect(pickOffer(offers, null, 500, today)).toBeNull();
    expect(eligibleOffers(offers, null, today)).toEqual([]);
  });

  it("slår ihop favoriter utan dubbletter", () => {
    expect(mergeFavorites(["a", "b"], ["b", "c", ""])).toEqual(["a", "b", "c"]);
  });

  it("tar med rabatten i meddelandet till butiken", () => {
    const order: Order = {
      id: "o3",
      number: "AC-1",
      createdAt: today,
      status: "ny",
      fulfilment: "pickup",
      pickupStoreId: "fittja",
      shipFromStoreId: null,
      customer: { name: "Amina", phone: "0701112233", address: "", postalCode: "", city: "" },
      items: [{ productId: "soap", name: "Tvål", qty: 1, unitPrice: 200, image: "" }],
      subtotal: 200,
      total: 180,
      discount: { offerId: "new_customer", title: "Rabatt för nya kunder", amount: 20 },
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
    const plain = text.replaceAll("\u00a0", " ");
    expect(plain).toContain("Rabatt för nya kunder");
    expect(plain).toContain("Rabatt: 20 kr");
    expect(plain).toContain("Totalt: 180 kr");
    expect(plain).toContain("Ordervärde före rabatt: 200 kr");
  });
});
