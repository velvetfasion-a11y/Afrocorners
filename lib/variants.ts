import { normalizeName, slugify, unitPrice } from "./format";
import type { Product, ProductVariant, StoreId } from "./types";

const SEPARATOR = " – ";

export function variantBaseName(name: string): { base: string; label: string } | null {
  const index = name.indexOf(SEPARATOR);
  if (index < 2) return null;
  const base = name.slice(0, index).trim();
  const label = name.slice(index + SEPARATOR.length).trim();
  if (base.length < 2 || !label) return null;
  return { base, label };
}

export function productVariants(product: Pick<Product, "variants">): ProductVariant[] {
  return product.variants?.filter((variant) => variant.label.trim()) ?? [];
}

export function hasVariants(product: Pick<Product, "variants">): boolean {
  return productVariants(product).length > 0;
}

export function cartKey(productId: string, variantId?: string | null): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

export function parseCartKey(key: string): { productId: string; variantId?: string } {
  const split = key.indexOf("::");
  if (split < 0) return { productId: key };
  const variantId = key.slice(split + 2);
  return { productId: key.slice(0, split), variantId: variantId || undefined };
}

export function findVariant(product: Product, variantId?: string | null): ProductVariant | undefined {
  if (!variantId) return undefined;
  return productVariants(product).find((variant) => variant.id === variantId);
}

export function variantInStock(variant: ProductVariant): boolean {
  return (variant.stock.fittja ?? 0) + (variant.stock.marsta ?? 0) > 0;
}

export function defaultVariant(product: Product): ProductVariant | undefined {
  const variants = productVariants(product);
  return variants.find(variantInStock) ?? variants[0];
}

export function variantPrice(product: Product, variant?: ProductVariant | null): number {
  return variant ? variant.price : unitPrice(product);
}

export function variantImage(product: Product, variant?: ProductVariant | null): string {
  return variant?.image || product.images[0] || "";
}

export function variantTitle(product: Product, variant?: ProductVariant | null): string {
  return variant ? `${product.name} – ${variant.label}` : product.name;
}

export function storeQty(product: Product, storeId: StoreId, variant?: ProductVariant | null): number {
  const stock = variant ? variant.stock : product.stock;
  return stock?.[storeId] ?? 0;
}

/** Lowest price, and whether the card should say "från". */
export function priceSpan(product: Product): { amount: number; from: boolean } {
  const variants = productVariants(product);
  if (variants.length === 0) return { amount: unitPrice(product), from: false };
  const prices = variants.map((variant) => variant.price);
  const amount = Math.min(...prices);
  return { amount, from: Math.max(...prices) !== amount };
}

export function rollupStock(variants: ProductVariant[]): Record<StoreId, number> {
  return {
    fittja: variants.reduce((sum, variant) => sum + (variant.stock.fittja ?? 0), 0),
    marsta: variants.reduce((sum, variant) => sum + (variant.stock.marsta ?? 0), 0),
  };
}

export interface MergePlan {
  survivor: Product;
  retireIds: string[];
}

function uniqueVariantId(label: string, used: Set<string>, fallback: string): string {
  let id = slugify(label) || fallback;
  let n = 2;
  while (used.has(id)) {
    id = `${slugify(label) || fallback}-${n}`;
    n += 1;
  }
  used.add(id);
  return id.slice(0, 80);
}

/**
 * Groups active single-size SumUp products whose names share "Base – size".
 * Products that already have variants are left alone, so a second run is a no-op.
 */
export function planVariantMerges(products: Product[]): MergePlan[] {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    if (product.active === false || productVariants(product).length > 0) continue;
    const split = variantBaseName(product.name);
    if (!split) continue;
    const key = normalizeName(split.base);
    const list = groups.get(key) ?? [];
    list.push(product);
    groups.set(key, list);
  }
  const plans: MergePlan[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const ordered = [...members].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    const base = variantBaseName(ordered[0].name)!.base;
    const used = new Set<string>();
    const variants: ProductVariant[] = ordered.map((product) => {
      const split = variantBaseName(product.name)!;
      const variant: ProductVariant = {
        id: uniqueVariantId(split.label, used, product.id),
        label: split.label,
        price: product.price,
        stock: { fittja: product.stock.fittja ?? 0, marsta: product.stock.marsta ?? 0 },
      };
      if (product.sku.trim()) variant.sumupSku = product.sku.trim();
      if (product.images[0]) variant.image = product.images[0];
      return variant;
    });
    const survivorSource = ordered[0];
    const others = new Set(products.filter((product) => !ordered.some((member) => member.id === product.id)).map((product) => product.slug));
    const wanted = slugify(base) || survivorSource.slug;
    const images = [...new Set(ordered.flatMap((product) => product.images))].slice(0, 6);
    const description = [...ordered].sort((a, b) => b.description.length - a.description.length)[0]?.description ?? "";
    plans.push({
      survivor: {
        ...survivorSource,
        name: base,
        slug: others.has(wanted) ? survivorSource.slug : wanted,
        description,
        price: Math.min(...variants.map((variant) => variant.price)),
        images: images.length ? images : survivorSource.images,
        stock: rollupStock(variants),
        offer: ordered.some((product) => product.offer),
        news: ordered.some((product) => product.news),
        variants,
      },
      retireIds: ordered.slice(1).map((product) => product.id),
    });
  }
  return plans;
}
