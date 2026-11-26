import { syncSumup } from "@/lib/sumup/sync";

export const dynamic = "force-dynamic";

/**
 * SumUp only sends webhooks for checkouts created with a return_url
 * (event CHECKOUT_STATUS_CHANGED). Ordinary in-store sales from the SumUp
 * app are not pushed. This route still verifies the shared token and then
 * runs the same idempotent poll, which is what actually reads sales.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const expected = process.env.SUMUP_WEBHOOK_TOKEN;
  if (!expected || token !== expected) return new Response(null, { status: 401 });
  const body = (await req.json().catch(() => null)) as { event_type?: string } | null;
  if (body?.event_type && body.event_type !== "CHECKOUT_STATUS_CHANGED") {
    return new Response(null, { status: 200 });
  }
  try {
    await syncSumup();
  } catch {
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 200 });
}
