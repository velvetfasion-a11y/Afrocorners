import { slugify } from "@/lib/format";
import { readDatabase, saveProduct } from "@/lib/server/db";
import { isUser, json, requireAdmin } from "@/lib/server/guard";
import type { CategoryId, Product, StoreId } from "@/lib/types";

const CATEGORIES: CategoryId[] = ["harvard", "skonhet", "mat", "kultur", "accessoarer"];

export function sanitizeProduct(input: Partial<Product>, id: string): Product | string {
  const name = input.name?.trim() ?? "";
  if (name.length < 2) return "Namn behövs.";
  if (typeof input.price !== "number" || input.price < 0) return "Priset behöver vara ett tal.";
  if (!input.category || !CATEGORIES.includes(input.category)) return "Välj kategori.";
  const stock = {
    fittja: Math.max(0, Math.round(input.stock?.fittja ?? 0)),
    marsta: Math.max(0, Math.round(input.stock?.marsta ?? 0)),
  } satisfies Record<StoreId, number>;
  const sale = input.salePrice == null || input.salePrice === ("" as unknown) ? null : Number(input.salePrice);
  return {
    id,
    slug: slugify(input.slug?.trim() || name) || id,
    sku: (input.sku ?? "").trim(),
    name,
    description: (input.description ?? "").trim(),
    price: Math.round(input.price),
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
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const body = (await req.json().catch(() => ({}))) as Partial<Product>;
  const id = body.id?.trim() || crypto.randomUUID();
  const product = sanitizeProduct(body, id);
  if (typeof product === "string") return json({ error: product }, 400);
  const db = await readDatabase();
  if (db.products.some((item) => item.slug === product.slug && item.id !== product.id)) {
    product.slug = `${product.slug}-${product.id.slice(0, 4)}`;
  }
  await saveProduct(product);
  return json({ product });
}
