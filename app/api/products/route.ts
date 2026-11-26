import { readDatabase, saveProduct } from "@/lib/server/db";
import { isUser, json, requireAdmin } from "@/lib/server/guard";
import { sanitizeProduct } from "@/lib/server/sanitize-product";
import type { Product } from "@/lib/types";

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
