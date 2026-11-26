import { readDatabase, dataMode } from "@/lib/server/db";
import { json } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await readDatabase();
  return json({
    mode: dataMode(),
    products: db.products,
    content: db.content,
  });
}
