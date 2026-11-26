import { sumupReaders } from "@/lib/sumup/client";
import { isUser, json, requireAdmin } from "@/lib/server/guard";
import { listConnections } from "@/lib/server/secrets";

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const connections = await listConnections();
  const readers: { id: string; name: string; device: string; status: string; merchantCode: string }[] = [];
  const notes: string[] = [];
  for (const connection of connections) {
    const codes = [connection.merchantCode, ...connection.extraMerchantCodes].filter(Boolean);
    for (const merchantCode of codes) {
      try {
        const items = await sumupReaders(connection, merchantCode);
        readers.push(...items.map((reader) => ({ ...reader, merchantCode })));
      } catch (error) {
        notes.push(error instanceof Error ? error.message : "Kunde inte hämta läsare.");
      }
    }
  }
  return json({
    readers,
    note:
      readers.length === 0
        ? "Inga kortläsare syntes via API:t. Vanliga köp i SumUp-appen skickar inte med vilken läsare som tog betalt. Koppla varje SumUp-konto till Fittja eller Märsta."
        : "En läsare används bara om SumUp skickar med läsarens id på kvittot. Det gör försäljnings-API:t inte i dag, så kontot (merchant code) styr butiken.",
    notes,
  });
}
