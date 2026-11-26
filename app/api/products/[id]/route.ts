import { deleteProduct, readDatabase, saveProduct } from "@/lib/server/db";
import { isUser, json, requireAdmin } from "@/lib/server/guard";
import type { Product } from "@/lib/types";
import { sanitizeProduct } from "../route";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as Partial<Product>;
  const product = sanitizeProduct({ ...body, id }, id);
  if (typeof product === "string") return json({ error: product }, 400);
  const db = await readDatabase();
  if (db.products.some((item) => item.slug === product.slug && item.id !== id)) {
    product.slug = `${product.slug}-${id.slice(0, 4)}`;
  }
  await saveProduct(product);
  return json({ product });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  await deleteProduct(id);
  return json({ ok: true });
}
