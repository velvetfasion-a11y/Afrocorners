import { normalizeOffers } from "@/lib/offers";
import { readOffers, writeOffers } from "@/lib/server/db";
import { isUser, json, requireAdmin } from "@/lib/server/guard";
import type { ShopOffer } from "@/lib/offers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  return json({ offers: await readOffers() });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const body = (await req.json().catch(() => null)) as { offers?: Partial<ShopOffer>[] } | null;
  const offers = await writeOffers(normalizeOffers(body?.offers));
  return json({ offers });
}
