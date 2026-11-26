"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InlineNote, Loading, storeName, useBundle } from "@/components/admin/bits";
import { api } from "@/components/admin/api";
import { sek, toE164 } from "@/lib/format";
import { customerReply, smsUrl, whatsappUrl } from "@/lib/orders";
import { ORDER_STATUS_LABEL, type Order, type OrderStatus, type StoreId } from "@/lib/types";

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

const CHIP: Record<OrderStatus, string> = {
  ny: "bg-[#f3e2b8] text-bark",
  bekraftad: "bg-[#efe4d4] text-brown",
  betald: "bg-[#e5f0e6] text-[#1d4d32]",
  klar: "bg-bark text-cream",
  avbruten: "bg-cream-2 text-muted",
};

function readStatus(): "" | OrderStatus {
  if (typeof window === "undefined") return "";
  const value = new URLSearchParams(window.location.search).get("status");
  return STATUSES.includes(value as OrderStatus) ? (value as OrderStatus) : "";
}

export function OrdersPage() {
  const { data, error, reload } = useBundle();
  const [filter, setFilter] = useState<"" | OrderStatus>("");
  const [note, setNote] = useState("");
  const [undo, setUndo] = useState<{ id: string; status: OrderStatus } | null>(null);
  const [shipChoice, setShipChoice] = useState<string | null>(null);
  useEffect(() => { setFilter(readStatus()); }, []);
  if (!data) return <Loading label="Hämtar beställningar…" />;
  const orders = data.orders.filter((order) => !filter || order.status === filter);

  async function setStatus(order: Order, status: OrderStatus, shipFrom: StoreId = "fittja") {
    setNote("");
    const previous = order.status;
    const data = await api<{ order: Order }>(`/api/orders/${order.id}`, { method: "PUT", body: JSON.stringify({ status, shipFrom }) });
    setUndo({ id: order.id, status: previous });
    setNote(`${order.number} är nu ${ORDER_STATUS_LABEL[data.order.status].toLowerCase()}.`);
    setShipChoice(null);
    reload();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl">Beställningar</h1>
      <p className="mt-1 text-sm text-muted">Bekräfta, markera betald eller skickad direkt på kortet.</p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <button type="button" className={`h-11 shrink-0 rounded-full px-4 text-sm ${filter === "" ? "bg-bark text-cream" : "bg-paper"}`} onClick={() => setFilter("")}>Alla</button>
        {STATUSES.map((status) => (
          <button key={status} type="button" className={`h-11 shrink-0 rounded-full px-4 text-sm ${filter === status ? "bg-bark text-cream" : "bg-paper"}`} onClick={() => setFilter(status)}>{ORDER_STATUS_LABEL[status]}</button>
        ))}
      </div>
      {note && (
        <div className="mt-3">
          <InlineNote>
            {note}{" "}
            {undo && <button type="button" className="underline" onClick={async () => { await api(`/api/orders/${undo.id}`, { method: "PUT", body: JSON.stringify({ status: undo.status, shipFrom: "fittja" }) }); setUndo(null); setNote("Ångrat."); reload(); }}>Ångra</button>}
          </InlineNote>
        </div>
      )}
      {error && <div className="mt-3"><InlineNote tone="err">{error}</InlineNote></div>}
      {orders.length === 0 && <p className="mt-6 rounded-3xl bg-paper px-4 py-8 text-center text-muted">Inga beställningar här. När en kund skickar en order syns den direkt.</p>}
      <ul className="mt-4 space-y-3">
        {orders.map((order) => {
          const reply = customerReply(order);
          return (
            <li key={order.id} className="rounded-3xl bg-paper p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{order.number}</p>
                  <p className="text-sm text-muted">{order.customer.name} · {order.fulfilment === "pickup" ? `Hämtas i ${storeName(order.pickupStoreId || "fittja")}` : "Hemleverans"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm ${CHIP[order.status]}`}>{ORDER_STATUS_LABEL[order.status]}</span>
              </div>
              <p className="mt-2 font-display text-3xl">{sek(order.total)}</p>
              <ul className="mt-2 text-sm text-brown">
                {order.items.map((item) => <li key={item.productId}>{item.qty} × {item.name}</li>)}
              </ul>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a className="flex h-12 items-center justify-center rounded-full bg-[#128C7E] text-sm font-medium text-white" href={whatsappUrl(toE164(order.customer.phone), reply)} target="_blank" rel="noreferrer">WhatsApp</a>
                <a className="flex h-12 items-center justify-center rounded-full border border-line text-sm font-medium" href={smsUrl(toE164(order.customer.phone), reply)}>SMS</a>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Action label="Bekräfta" onClick={() => setStatus(order, "bekraftad")} />
                <Action label="Markera betald" onClick={() => setStatus(order, "betald")} />
                <Action label="Skickad/Hämtad" onClick={() => order.fulfilment === "delivery" ? setShipChoice(order.id) : setStatus(order, "klar", order.pickupStoreId || "fittja")} />
              </div>
              {shipChoice === order.id && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Action label="Ta från Fittja" onClick={() => setStatus(order, "klar", "fittja")} />
                  <Action label="Ta från Märsta" onClick={() => setStatus(order, "klar", "marsta")} />
                </div>
              )}
              <Link href={`/admin/ordrar/${order.id}`} className="mt-3 inline-flex h-11 items-center text-sm underline">Visa allt</Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Action({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="h-12 rounded-full bg-cream text-sm font-medium" onClick={onClick}>{label}</button>;
}

export function OrderDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    api<{ orders: Order[] }>("/api/orders").then((data) => {
      if (!cancelled) setOrder(data.orders.find((item) => item.id === id) ?? null);
    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Fel"); });
    return () => { cancelled = true; };
  }, [id]);
  if (!order) return error ? <InlineNote tone="err">{error}</InlineNote> : <Loading label="Hämtar ordern…" />;
  const reply = customerReply(order);
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <Link href="/admin/ordrar" className="text-sm underline">Tillbaka</Link>
      <h1 className="font-display text-4xl">{order.number}</h1>
      <span className={`inline-flex rounded-full px-3 py-1 text-sm ${CHIP[order.status]}`}>{ORDER_STATUS_LABEL[order.status]}</span>
      <p className="text-lg">{order.customer.name}<br />{order.customer.phone}</p>
      {order.fulfilment === "delivery" && <p>{order.customer.address}, {order.customer.postalCode} {order.customer.city}</p>}
      <ul>{order.items.map((item) => <li key={item.productId}>{item.qty} × {item.name} · {sek(item.unitPrice * item.qty)}</li>)}</ul>
      <p className="font-display text-3xl">{sek(order.total)}</p>
      <div className="grid grid-cols-2 gap-2">
        <a className="flex h-12 items-center justify-center rounded-full bg-[#128C7E] text-white" href={whatsappUrl(toE164(order.customer.phone), reply)} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className="flex h-12 items-center justify-center rounded-full border border-line" href={smsUrl(toE164(order.customer.phone), reply)}>SMS</a>
      </div>
    </div>
  );
}
