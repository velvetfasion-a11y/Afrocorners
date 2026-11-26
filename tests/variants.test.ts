import { describe, expect, it } from "vitest";
import { commitMovement, type InventoryPort } from "../lib/inventory";
import { matchProduct, matchVariant, planSumupSync } from "../lib/sumup/plan";
import { sanitizeProduct } from "../lib/server/sanitize-product";
import type { Product } from "../lib/types";
import { defaultVariant, planVariantMerges, priceSpan, variantBaseName } from "../lib/variants";

function product(partial: Partial<Product> & Pick<Product, "id" | "name">): Product {
  return {
    slug: partial.id,
    sku: "",
    description: "",
    price: 50,
    salePrice: null,
    badge: "",
    category: "mat",
    images: [`/products/${partial.id}.webp`],
    offer: false,
    news: false,
    sortOrder: 100,
    stock: { fittja: 1, marsta: 0 },
    active: true,
    ...partial,
  };
}

describe("storlekar", () => {
  it("delar namn på tankstreck", () => {
    expect(variantBaseName("Black Eye Beans – 2kg")).toEqual({ base: "Black Eye Beans", label: "2kg" });
    expect(variantBaseName("Baking Soda")).toBeNull();
  });

  it("slår ihop sumup-rader och är idempotent", () => {
    const rows = [
      product({ id: "sumup-black-eye-beans-900g", name: "Black Eye Beans – 900g", price: 50, sortOrder: 20, stock: { fittja: 1, marsta: 2 } }),
      product({ id: "sumup-black-eye-beans-2kg", name: "Black Eye Beans – 2kg", price: 100, sortOrder: 10, stock: { fittja: 4, marsta: 0 }, sku: "BEB-2" }),
      product({ id: "sumup-baking-soda", name: "Baking Soda", price: 50 }),
    ];
    const [plan] = planVariantMerges(rows);
    expect(plan.survivor.id).toBe("sumup-black-eye-beans-2kg");
    expect(plan.survivor.name).toBe("Black Eye Beans");
    expect(plan.survivor.price).toBe(50);
    expect(plan.survivor.variants?.map((variant) => variant.label)).toEqual(["2kg", "900g"]);
    expect(plan.survivor.variants?.[0].sumupSku).toBe("BEB-2");
    expect(plan.survivor.stock).toEqual({ fittja: 5, marsta: 2 });
    expect(plan.retireIds).toEqual(["sumup-black-eye-beans-900g"]);
    const again = planVariantMerges([plan.survivor, product({ id: "sumup-baking-soda", name: "Baking Soda" })]);
    expect(again).toEqual([]);
  });

  it("visar från-pris när storlekarna kostar olika", () => {
    const beans = product({
      id: "beans",
      name: "Black Eye Beans",
      variants: [
        { id: "900g", label: "900g", price: 50, stock: { fittja: 0, marsta: 0 } },
        { id: "2kg", label: "2kg", price: 100, stock: { fittja: 3, marsta: 0 } },
      ],
    });
    expect(priceSpan(beans)).toEqual({ amount: 50, from: true });
    expect(defaultVariant(beans)?.id).toBe("2kg");
  });

  it("drar lager från vald storlek", async () => {
    const beans = product({
      id: "beans",
      name: "Black Eye Beans",
      stock: { fittja: 4, marsta: 0 },
      variants: [
        { id: "900g", label: "900g", price: 50, stock: { fittja: 1, marsta: 0 } },
        { id: "2kg", label: "2kg", price: 100, stock: { fittja: 3, marsta: 0 } },
      ],
    });
    let saved = beans;
    const port: InventoryPort = {
      async getProduct() { return saved; },
      async saveProduct(next) { saved = next; },
      async findLogByExternalRef() { return null; },
      async addLog() {},
    };
    await commitMovement(port, { storeId: "fittja", productId: "beans", variantId: "2kg", delta: -1, reason: "in_store_sale", source: "admin" });
    expect(saved.variants?.find((variant) => variant.id === "2kg")?.stock.fittja).toBe(2);
    expect(saved.variants?.find((variant) => variant.id === "900g")?.stock.fittja).toBe(1);
    expect(saved.stock.fittja).toBe(3);
  });

  it("matchar SumUp-raden mot rätt storlek", () => {
    const beans = {
      id: "beans",
      name: "Black Eye Beans",
      sku: "",
      variants: [
        { id: "900g", label: "900g" },
        { id: "2kg", label: "2kg", sumupSku: "BEB-2" },
      ],
    };
    expect(matchVariant({ sku: "BEB-2", name: "något" }, beans)?.id).toBe("2kg");
    expect(matchVariant({ sku: "", name: "Black Eye Beans – 900g" }, beans)?.id).toBe("900g");
    const plan = planSumupSync({
      lines: [{ merchantCode: "M", saleId: "s", lineId: "l", type: "CATALOG", name: "Black Eye Beans – 2kg", quantity: 1, unitId: "each", sku: "", catalogReference: "", operation: "sale" }],
      refunds: [],
      barePayments: [],
      applied: [],
      products: [beans],
      mappings: [],
      locations: [{ kind: "merchant", externalId: "M", storeId: "fittja" }],
    });
    expect(plan.intents[0]).toEqual(expect.objectContaining({ productId: "beans", variantId: "2kg", delta: -1 }));
    expect(matchProduct({ sku: "", name: "Black Eye Beans – 2kg", catalogReference: "" }, [beans], [])?.id).toBe("beans");
  });

  it("behåller varor utan storlek", () => {
    const clean = sanitizeProduct({ name: "Tvål", price: 40, category: "skonhet" }, "soap");
    expect(typeof clean).not.toBe("string");
    if (typeof clean === "string") return;
    expect(clean.variants).toBeUndefined();
    expect(clean.price).toBe(40);
  });
});
