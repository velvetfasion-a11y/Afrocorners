import { ShopShell } from "@/components/site/shell";
import { readDatabase } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const db = await readDatabase();
  return (
    <ShopShell initialProducts={db.products.filter((product) => product.active)} initialContent={db.content}>
      {children}
    </ShopShell>
  );
}
