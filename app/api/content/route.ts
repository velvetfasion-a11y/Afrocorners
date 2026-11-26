import { saveContent } from "@/lib/server/db";
import { isUser, json, requireAdmin } from "@/lib/server/guard";
import type { SiteContent } from "@/lib/types";

export async function PUT(req: Request) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const content = (await req.json().catch(() => null)) as SiteContent | null;
  if (!content?.stores || !content.heroSlides || !content.ownerPhone) {
    return json({ error: "Innehållet är ofullständigt." }, 400);
  }
  content.freeShippingThreshold = Math.max(0, Math.round(content.freeShippingThreshold || 0));
  await saveContent(content);
  return json({ content });
}
