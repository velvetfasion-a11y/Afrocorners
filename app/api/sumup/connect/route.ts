import { sumupMe } from "@/lib/sumup/client";
import { isUser, json, requireAdmin } from "@/lib/server/guard";
import { listConnections, publicConnection, removeConnection, saveConnection, secretHint, type SumupConnection } from "@/lib/server/secrets";

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const body = (await req.json().catch(() => ({}))) as { apiKey?: string };
  const apiKey = body.apiKey?.trim() ?? "";
  if (apiKey.length < 12) return json({ error: "Klistra in API-nyckeln från SumUp." }, 400);
  const connection: SumupConnection = {
    id: crypto.randomUUID(),
    authType: "api_key",
    apiKey,
    merchantCode: "",
    merchantName: "",
    extraMerchantCodes: [],
    keyHint: secretHint(apiKey),
  };
  try {
    const me = await sumupMe(connection);
    connection.merchantCode = me.merchantCode;
    connection.merchantName = me.merchantName;
    await saveConnection(connection);
    return json({ connection: publicConnection(connection) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "SumUp tog inte emot nyckeln." }, 400);
  }
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id || body.id === "env") return json({ error: "Den här anslutningen styrs av miljövariabeln SUMUP_API_KEY." }, 400);
  await removeConnection(body.id);
  const connections = await listConnections();
  return json({ connections: connections.map(publicConnection) });
}
