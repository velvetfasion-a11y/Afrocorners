import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { dataMode } from "@/lib/server/db";
import { firebaseAdminApp } from "@/lib/server/firebase-admin";
import { isUser, json, requireAdmin } from "@/lib/server/guard";

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const body = (await req.json().catch(() => null)) as { dataUrl?: string } | null;
  const match = body?.dataUrl?.match(/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return json({ error: "Bilden kunde inte läsas." }, 400);
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 4_000_000) return json({ error: "Bilden är för stor (max 4 MB)." }, 400);
  const ext = match[1].includes("png") ? "png" : match[1].includes("webp") ? "webp" : "jpg";
  const name = `${crypto.randomUUID()}.${ext}`;

  if (dataMode() === "firebase") {
    const app = firebaseAdminApp();
    if (!app) return json({ error: "Firebase Storage är inte konfigurerat." }, 500);
    const { getStorage } = await import("firebase-admin/storage");
    const bucket = getStorage(app).bucket();
    const file = bucket.file(`products/${name}`);
    const token = crypto.randomUUID();
    await file.save(buffer, {
      contentType: match[1],
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`;
    return json({ url });
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buffer);
  return json({ url: `/uploads/${name}` });
}
