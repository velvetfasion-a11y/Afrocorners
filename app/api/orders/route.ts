import { makeOrderNumber } from "@/lib/format";
import { customerFromRequest, InvalidCustomerToken } from "@/lib/server/customers";
import { createPricedOrder, readDatabase, readOffers, recordCustomerOrder } from "@/lib/server/db";
import { isUser, json, requireAdmin } from "@/lib/server/guard";
import type { Fulfilment, StoreId } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!isUser(admin)) return admin;
  const db = await readDatabase();
  return json({ orders: db.orders, logs: db.logs, sumup: db.sumup });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    items?: { productId: string; variantId?: string; qty: number }[];
    fulfilment?: Fulfilment;
    pickupStoreId?: StoreId | null;
    customer?: { name?: string; phone?: string; address?: string; postalCode?: string; city?: string };
  } | null;
  if (!body?.items?.length || (body.fulfilment !== "delivery" && body.fulfilment !== "pickup")) {
    return json({ error: "Fyll i beställningen." }, 400);
  }
  const name = body.customer?.name?.trim() ?? "";
  const phone = body.customer?.phone?.trim() ?? "";
  if (name.length < 2 || phone.replace(/\D/g, "").length < 7) {
    return json({ error: "Namn och telefon behövs." }, 400);
  }
  if (body.fulfilment === "delivery") {
    if (!body.customer?.address?.trim() || !body.customer?.postalCode?.trim() || !body.customer?.city?.trim()) {
      return json({ error: "Adress, postnummer och ort behövs för hemleverans." }, 400);
    }
  }
  if (body.fulfilment === "pickup" && body.pickupStoreId !== "fittja" && body.pickupStoreId !== "marsta") {
    return json({ error: "Välj butik att hämta i." }, 400);
  }
  try {
    const account = await customerFromRequest(req);
    const order = await createPricedOrder({
      items: body.items,
      fulfilment: body.fulfilment,
      pickupStoreId: body.pickupStoreId ?? null,
      customer: {
        name,
        phone,
        address: body.customer?.address?.trim() ?? "",
        postalCode: body.customer?.postalCode?.trim() ?? "",
        city: body.customer?.city?.trim() ?? "",
      },
      number: makeOrderNumber(),
      customerUid: account?.uid ?? null,
      account,
      offers: account ? await readOffers() : [],
    });
    if (account) await recordCustomerOrder(account.uid, order.createdAt);
    return json({ order });
  } catch (error) {
    if (error instanceof InvalidCustomerToken) return json({ error: error.message }, 401);
    return json({ error: error instanceof Error ? error.message : "Kunde inte spara ordern." }, 400);
  }
}
