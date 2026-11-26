import { slugify } from "@/lib/format";
import type { CategoryId, Product, ProductVariant, StoreId } from "@/lib/types";
import { rollupStock } from "@/lib/variants";

const CATEGORIES: CategoryId[] = ["harvard", "skonhet", "mat", "kultur", "accessoarer"];

function stockOf(input: { fittja?: number; marsta?: number } | undefined): Record<StoreId, number> {
  return {
    fittja: Math.max(0, Math.round(input?.fittja ?? 0)),
    marsta: Math.max(0, Math.round(input?.marsta ?? 0)),
  };
}

function sanitizeVariants(input: Product["variants"]): ProductVariant[] | undefined {
  if (!input?.length) return undefined;
  const used = new Set<string>();
  const variants: ProductVariant[] = [];
  for (const raw of input.slice(0, 12)) {
    const label = raw.label?.trim().slice(0, 40) ?? "";
    if (label.length < 1) continue;
    const price = Number(raw.price);
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) return undefined;
    let id = (raw.id?.trim() || slugify(label) || "storlek").slice(0, 80);
    while (used.has(id)) id = `${id}-2`.slice(0, 80);
    used.add(id);
    const variant: ProductVariant = { id, label, price: Math.round(price), stock: stockOf(raw.stock) };
    const sku = raw.sumupSku?.trim().slice(0, 80);
    const image = raw.image?.trim().slice(0, 300);
    if (sku) variant.sumupSku = sku;
    if (image) variant.image = image;
    variants.push(variant);
  }
  return variants.length ? variants : undefined;
}

export function sanitizeProduct(input: Partial<Product>, id: string): Product | string {
  const name = input.name?.trim() ?? "";
  if (name.length < 2) return "Namn behövs.";
  if (typeof input.price !== "number" || input.price < 0) return "Priset behöver vara ett tal.";
  if (!input.category || !CATEGORIES.includes(input.category)) return "Välj kategori.";
  if (input.variants?.length && sanitizeVariants(input.variants) === undefined && input.variants.some((variant) => variant.label?.trim())) {
    return "Varje storlek behöver ett pris.";
  }
  const variants = sanitizeVariants(input.variants);
  const stock = variants ? rollupStock(variants) : stockOf(input.stock);
  const sale = input.salePrice == null || input.salePrice === ("" as unknown) ? null : Number(input.salePrice);
  const product: Product = {
    id,
    slug: slugify(input.slug?.trim() || name) || id,
    sku: (input.sku ?? "").trim(),
    name,
    description: (input.description ?? "").trim(),
    price: variants ? Math.min(...variants.map((variant) => variant.price)) : Math.round(input.price),
    salePrice: sale != null && !Number.isNaN(sale) ? Math.round(sale) : null,
    badge: (input.badge ?? "").trim(),
    category: input.category,
    images: (input.images ?? []).filter((image) => typeof image === "string" && image.length > 0).slice(0, 6),
    offer: Boolean(input.offer),
    news: Boolean(input.news),
    sortOrder: Math.round(input.sortOrder ?? 0),
    stock,
    active: input.active !== false,
  };
  if (variants) product.variants = variants;
  return product;
}
