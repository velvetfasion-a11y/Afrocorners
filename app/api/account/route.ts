import { eligibleOffers, stockholmDate } from "@/lib/offers";
import { customerFromRequest, InvalidCustomerToken } from "@/lib/server/customers";
import { ordersForCustomer, readOffers } from "@/lib/server/db";
import { json } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const customer = await customerFromRequest(req);
    if (!customer) return json({ error: "Logga in med Google." }, 401);
    const offers = eligibleOffers(await readOffers(), customer, stockholmDate());
    const orders = await ordersForCustomer(customer.uid);
    return json({ customer, offers, orders });
  } catch (error) {
    if (error instanceof InvalidCustomerToken) return json({ error: error.message }, 401);
    return json({ error: "Kunde inte hämta kontot." }, 500);
  }
}
