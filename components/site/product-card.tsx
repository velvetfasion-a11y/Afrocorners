"use client";

import { Minus, Plus } from "lucide-react";
import Link from "next/link";
import { badgeFor, sek, unitPrice } from "@/lib/format";
import type { Product } from "@/lib/types";
import { hasVariants, priceSpan } from "@/lib/variants";
import { useShop } from "./shell";

export function ProductCard({ product }: { product: Product }) {
  const { cart, add, setQty } = useShop();
  const sized = hasVariants(product);
  const qty = cart[product.id] ?? 0;
  const span = priceSpan(product);
  const price = sized ? span.amount : unitPrice(product);
  const badge = badgeFor(product);
  return (
    <article className="flex h-full flex-col">
      <Link href={`/produkt/${product.slug}`} className="relative block overflow-hidden rounded-[1.25rem] bg-cream-2">
        <img src={product.images[0]} alt={product.name} className="aspect-square w-full object-cover" />
        {badge && (
          <span className="absolute left-2 top-2 rounded-full bg-bark px-2 py-1 text-xs font-medium text-cream">{badge}</span>
        )}
      </Link>
      <h3 className="mt-3 font-display text-lg leading-tight text-ink">
        <Link href={`/produkt/${product.slug}`}>{product.name}</Link>
      </h3>
      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <p className="text-sm">
          {product.salePrice != null && product.salePrice < product.price && (
            <span className="mr-1 text-muted line-through">{sek(product.price)}</span>
          )}
          <span className="font-medium">{span.from ? `från ${sek(price)}` : sek(price)}</span>
        </p>
        {sized ? (
          <Link href={`/produkt/${product.slug}`} className="gold-btn grid h-10 w-10 place-items-center rounded-full" aria-label={`Välj storlek för ${product.name}`}>
            <Plus className="h-4 w-4" />
          </Link>
        ) : qty > 0 ? (
          <div className="flex items-center rounded-full border border-line bg-paper">
            <button type="button" className="grid h-10 w-10 place-items-center" aria-label={`Minska ${product.name}`} onClick={() => setQty(product.id, qty - 1)}>
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-5 text-center text-sm">{qty}</span>
            <button type="button" className="grid h-10 w-10 place-items-center" aria-label={`Öka ${product.name}`} onClick={() => add(product.id, 1)}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button type="button" className="gold-btn grid h-10 w-10 place-items-center rounded-full" aria-label={`Lägg ${product.name} i varukorgen`} onClick={() => add(product.id, 1)}>
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p className="rounded-3xl bg-paper px-5 py-10 text-center text-muted">Inga varor här just nu.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 xl:grid-cols-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
