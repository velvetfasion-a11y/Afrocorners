"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { api, uploadImage } from "@/components/admin/api";
import { sek, unitPrice } from "@/lib/format";
import { customerReply, smsUrl, whatsappUrl } from "@/lib/orders";
import { toE164 } from "@/lib/format";
import {
  CATEGORY_LABEL,
  LOW_STOCK_AT,
  ORDER_STATUS_LABEL,
  REASON_LABEL,
  WEEKDAYS,
  WEEKDAY_LABELS,
  type CategoryId,
  type Order,
  type OrderStatus,
  type Product,
  type SiteContent,
  type StockLogEntry,
  type StockReason,
  type StoreId,
  type SumupPending,
  type SumupState,
} from "@/lib/types";

type Bundle = { orders: Order[]; logs: StockLogEntry[]; sumup: SumupState };
type Catalog = { products: Product[]; content: SiteContent };

function useCatalog() {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  async function load() {
    const response = await fetch("/api/catalog");
    const json = await response.json();
    setData({ products: json.products, content: json.content });
  }
  useEffect(() => { load().catch((reason) => setError(String(reason))); }, []);
  return { data, error, reload: load };
}

function useBundle() {
  const [data, setData] = useState<Bundle | null>(null);
  const [error, setError] = useState("");
  async function load() {
    setData(await api<Bundle>("/api/orders"));
  }
  useEffect(() => { load().catch((reason) => setError(reason instanceof Error ? reason.message : "Fel")); }, []);
  return { data, error, reload: load };
}

export function Dashboard() {
  const catalog = useCatalog();
  const bundle = useBundle();
  const low = (catalog.data?.products ?? []).filter((product) => product.stock.fittja <= LOW_STOCK_AT || product.stock.marsta <= LOW_STOCK_AT);
  if (!catalog.data) return <p className="text-muted">Hämtar översikten…</p>;
  const fresh = (bundle.data?.orders ?? []).filter((order) => order.status === "ny");
  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl">Översikt</h1>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/admin/ordrar" className="rounded-3xl bg-paper p-4"><p className="text-sm text-muted">Nya ordrar</p><p className="font-display text-4xl">{fresh.length}</p></Link>
        <Link href="/admin/lager" className="rounded-3xl bg-paper p-4"><p className="text-sm text-muted">Lågt lager</p><p className="font-display text-4xl">{low.length}</p></Link>
      </div>
      <section className="rounded-3xl bg-paper p-4">
        <h2 className="font-medium">Lågt lager (≤ {LOW_STOCK_AT})</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {low.length === 0 && <li className="text-muted">Inget lågt lager just nu.</li>}
          {low.map((product) => (
            <li key={product.id} className="flex justify-between gap-3">
              <span>{product.name}</span>
              <span>Fittja {product.stock.fittja} · Märsta {product.stock.marsta}</span>
            </li>
          ))}
        </ul>
      </section>
      <Link href="/admin/salt" className="gold-btn flex h-14 items-center justify-center rounded-full text-base">Sålt i butik</Link>
      {(catalog.error || bundle.error) && <p className="text-sm text-red-800">{catalog.error || bundle.error}</p>}
    </div>
  );
}

export function ProductList() {
  const { data, reload } = useCatalog();
  const [q, setQ] = useState("");
  const products = (data?.products ?? []).filter((product) => product.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Produkter</h1>
        <Link href="/admin/produkter/ny" className="gold-btn rounded-full px-4 py-2 text-sm">Ny</Link>
      </div>
      <Input className="mt-4" placeholder="Sök" value={q} onChange={(event) => setQ(event.target.value)} />
      <ul className="mt-4 space-y-3">
        {products.map((product) => (
          <li key={product.id}>
            <Link href={`/admin/produkter/${product.id}`} className="flex gap-3 rounded-3xl bg-paper p-3">
              <img src={product.images[0] || "/images/cat-skonhet.jpg"} alt="" className="h-16 w-16 rounded-2xl object-cover" />
              <span>
                <span className="block font-medium">{product.name}</span>
                <span className="text-sm text-muted">{sek(unitPrice(product))} · Fittja {product.stock.fittja} · Märsta {product.stock.marsta}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" className="mt-4 text-sm underline" onClick={() => reload()}>Uppdatera</button>
    </div>
  );
}

const EMPTY: Product = {
  id: "",
  slug: "",
  sku: "",
  name: "",
  description: "",
  price: 0,
  salePrice: null,
  badge: "",
  category: "harvard",
  images: [],
  offer: false,
  news: false,
  sortOrder: 50,
  stock: { fittja: 0, marsta: 0 },
  active: true,
};

export function ProductForm({ id }: { id: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product>(EMPTY);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (id === "ny") return;
    fetch("/api/catalog").then((response) => response.json()).then((data) => {
      const found = (data.products as Product[]).find((item) => item.id === id);
      if (found) setProduct(found);
    });
  }, [id]);
  function patch(partial: Partial<Product>) { setProduct((current) => ({ ...current, ...partial })); }
  async function save() {
    setError("");
    try {
      const path = id === "ny" ? "/api/products" : `/api/products/${id}`;
      const method = id === "ny" ? "POST" : "PUT";
      await api(path, { method, body: JSON.stringify(product) });
      router.push("/admin/produkter");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kunde inte spara.");
    }
  }
  return (
    <div className="space-y-3">
      <h1 className="font-display text-4xl">{id === "ny" ? "Ny produkt" : "Redigera"}</h1>
      <Label>Namn<Input value={product.name} onChange={(event) => patch({ name: event.target.value })} /></Label>
      <Label>SKU (samma som i SumUp om du vill)<Input value={product.sku} onChange={(event) => patch({ sku: event.target.value })} /></Label>
      <Label>Beskrivning<Textarea value={product.description} onChange={(event) => patch({ description: event.target.value })} /></Label>
      <div className="grid grid-cols-2 gap-3">
        <Label>Pris<Input type="number" value={product.price} onChange={(event) => patch({ price: Number(event.target.value) })} /></Label>
        <Label>Reapris<Input type="number" value={product.salePrice ?? ""} placeholder="Tomt = inget" onChange={(event) => patch({ salePrice: event.target.value === "" ? null : Number(event.target.value) })} /></Label>
      </div>
      <Label>Rabattmärke<Input value={product.badge} placeholder="-20% eller 2 för 1" onChange={(event) => patch({ badge: event.target.value })} /></Label>
      <Label>Kategori
        <select className="field" value={product.category} onChange={(event) => patch({ category: event.target.value as CategoryId })}>
          {Object.entries(CATEGORY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <Label>Lager Fittja<Input type="number" value={product.stock.fittja} onChange={(event) => patch({ stock: { ...product.stock, fittja: Number(event.target.value) } })} /></Label>
        <Label>Lager Märsta<Input type="number" value={product.stock.marsta} onChange={(event) => patch({ stock: { ...product.stock, marsta: Number(event.target.value) } })} /></Label>
      </div>
      <Label>Sortering<Input type="number" value={product.sortOrder} onChange={(event) => patch({ sortOrder: Number(event.target.value) })} /></Label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={product.offer} onChange={(event) => patch({ offer: event.target.checked })} /> Erbjudande</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={product.news} onChange={(event) => patch({ news: event.target.checked })} /> Nyhet</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={product.active} onChange={(event) => patch({ active: event.target.checked })} /> Syns i butiken</label>
      <div className="flex flex-wrap gap-2">
        {product.images.map((image, index) => (
          <label key={image + index} className="relative">
            <img src={image} alt="" className="h-24 w-24 rounded-2xl object-cover" />
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const url = await uploadImage(file);
              const images = [...product.images];
              images[index] = url;
              patch({ images });
            }} />
          </label>
        ))}
        <label className="grid h-24 w-24 cursor-pointer place-items-center rounded-2xl border border-dashed border-line text-sm">
          Bild
          <input type="file" accept="image/*" className="hidden" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            patch({ images: [...product.images, await uploadImage(file)] });
          }} />
        </label>
      </div>
      {error && <p className="text-sm text-red-800">{error}</p>}
      <Button type="button" onClick={save}>Spara</Button>
      {id !== "ny" && <Button type="button" variant="danger" onClick={() => setConfirm(true)}>Ta bort</Button>}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>Ta bort produkten?</DialogTitle>
          <p className="mt-2 text-sm text-muted">Den försvinner från butiken.</p>
          <Button className="mt-4" variant="danger" onClick={async () => { await api(`/api/products/${id}`, { method: "DELETE" }); router.push("/admin/produkter"); }}>Ta bort</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function move(productId: string, storeId: StoreId, delta: number, reason: StockReason) {
  await api("/api/stock", { method: "POST", body: JSON.stringify({ productId, storeId, delta, reason }) });
}

export function StockPage() {
  const { data, reload } = useCatalog();
  const [restock, setRestock] = useState<Record<string, string>>({});
  return (
    <div>
      <h1 className="font-display text-4xl">Lager</h1>
      <ul className="mt-4 space-y-4">
        {(data?.products ?? []).map((product) => (
          <li key={product.id} className="rounded-3xl bg-paper p-3">
            <p className="font-medium">{product.name}</p>
            {(["fittja", "marsta"] as StoreId[]).map((storeId) => (
              <div key={storeId} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="w-16 capitalize">{storeId === "fittja" ? "Fittja" : "Märsta"}</span>
                <button type="button" className="h-11 w-11 rounded-full border border-line" onClick={async () => { await move(product.id, storeId, -1, "manual"); reload(); }}>−</button>
                <span className="w-8 text-center text-lg">{product.stock[storeId]}</span>
                <button type="button" className="h-11 w-11 rounded-full border border-line" onClick={async () => { await move(product.id, storeId, 1, "manual"); reload(); }}>+</button>
                <Input className="h-11 w-20" inputMode="numeric" placeholder="Antal" value={restock[`${product.id}-${storeId}`] ?? ""} onChange={(event) => setRestock({ ...restock, [`${product.id}-${storeId}`]: event.target.value })} />
                <button type="button" className="h-11 rounded-full bg-cream-2 px-3" onClick={async () => {
                  const qty = Math.round(Number(restock[`${product.id}-${storeId}`]));
                  if (!qty) return;
                  await move(product.id, storeId, qty, "restock");
                  setRestock({ ...restock, [`${product.id}-${storeId}`]: "" });
                  reload();
                }}>Inleverans</button>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PosPage() {
  const { data, reload } = useCatalog();
  const [storeId, setStoreId] = useState<StoreId>("fittja");
  const [q, setQ] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  useEffect(() => {
    const saved = localStorage.getItem("afrocorner-pos-store");
    if (saved === "fittja" || saved === "marsta") setStoreId(saved);
  }, []);
  function choose(next: StoreId) {
    setStoreId(next);
    localStorage.setItem("afrocorner-pos-store", next);
  }
  const products = useMemo(() => (data?.products ?? []).filter((product) => product.name.toLowerCase().includes(q.toLowerCase()) || product.sku.toLowerCase().includes(q.toLowerCase())), [data, q]);
  async function sell(product: Product, amount: number) {
    setNote("");
    await move(product.id, storeId, -Math.abs(amount), "in_store_sale");
    if (navigator.vibrate) navigator.vibrate(12);
    setNote(`${product.name}: ${Math.max(0, product.stock[storeId] - Math.abs(amount))} kvar i ${storeId === "fittja" ? "Fittja" : "Märsta"}.`);
    reload();
  }
  return (
    <div>
      <h1 className="font-display text-4xl">Sålt i butik</h1>
      <div className="sticky top-[6.5rem] z-10 mt-3 grid grid-cols-2 gap-2 bg-cream py-2">
        {(["fittja", "marsta"] as StoreId[]).map((id) => (
          <button key={id} type="button" className={`h-12 rounded-full ${storeId === id ? "gold-btn" : "bg-paper"}`} onClick={() => choose(id)}>{id === "fittja" ? "Fittja" : "Märsta"}</button>
        ))}
      </div>
      <Input className="mt-2" placeholder="Sök vara" value={q} onChange={(event) => setQ(event.target.value)} />
      {note && <p className="mt-3 text-sm text-brown">{note}</p>}
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {products.map((product) => (
          <li key={product.id} className="rounded-3xl bg-paper p-2">
            <img src={product.images[0]} alt="" className="aspect-square w-full rounded-2xl object-cover" />
            <p className="mt-2 text-sm font-medium leading-tight">{product.name}</p>
            <p className="text-2xl">{product.stock[storeId]}</p>
            <button type="button" className="mt-2 h-12 w-full rounded-full bg-bark text-cream" onClick={() => sell(product, 1)}>−1</button>
            <div className="mt-2 flex gap-1">
              <Input inputMode="numeric" value={qty[product.id] ?? ""} placeholder="Antal" onChange={(event) => setQty({ ...qty, [product.id]: event.target.value })} />
              <button type="button" className="rounded-full bg-cream-2 px-3 text-sm" onClick={() => sell(product, Math.max(1, Math.round(Number(qty[product.id] || 1))))}>Sälj</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LogPage() {
  const { data } = useBundle();
  const [store, setStore] = useState<"" | StoreId>("");
  const [reason, setReason] = useState<"" | StockReason>("");
  const rows = (data?.logs ?? []).filter((entry) => (!store || entry.storeId === store) && (!reason || entry.reason === reason));
  return (
    <div>
      <h1 className="font-display text-4xl">Lagerlogg</h1>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <select className="field" value={store} onChange={(event) => setStore(event.target.value as "" | StoreId)}>
          <option value="">Alla butiker</option>
          <option value="fittja">Fittja</option>
          <option value="marsta">Märsta</option>
        </select>
        <select className="field" value={reason} onChange={(event) => setReason(event.target.value as "" | StockReason)}>
          <option value="">Alla orsaker</option>
          {Object.entries(REASON_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {rows.map((entry) => (
          <li key={entry.id} className="rounded-2xl bg-paper px-3 py-2">
            <p className="font-medium">{entry.productName} <span className={entry.change < 0 ? "text-red-900" : "text-good"}>{entry.change > 0 ? `+${entry.change}` : entry.change}</span></p>
            <p className="text-muted">{new Date(entry.createdAt).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })} · {entry.storeId === "fittja" ? "Fittja" : "Märsta"} · {REASON_LABEL[entry.reason]}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

export function OrdersPage() {
  const { data, reload } = useBundle();
  const [filter, setFilter] = useState<"" | OrderStatus>("");
  const orders = (data?.orders ?? []).filter((order) => !filter || order.status === filter);
  return (
    <div>
      <h1 className="font-display text-4xl">Ordrar</h1>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        <button type="button" className={`shrink-0 rounded-full px-3 py-2 text-sm ${filter === "" ? "bg-bark text-cream" : "bg-paper"}`} onClick={() => setFilter("")}>Alla</button>
        {STATUSES.map((status) => (
          <button key={status} type="button" className={`shrink-0 rounded-full px-3 py-2 text-sm ${filter === status ? "bg-bark text-cream" : "bg-paper"}`} onClick={() => setFilter(status)}>{ORDER_STATUS_LABEL[status]}</button>
        ))}
      </div>
      <ul className="mt-4 space-y-3">
        {orders.map((order) => (
          <li key={order.id}><Link href={`/admin/ordrar/${order.id}`} className="block rounded-3xl bg-paper p-4" onClick={() => reload()}>
            <span className="flex justify-between"><span className="font-medium">{order.number}</span><span>{sek(order.total)}</span></span>
            <span className="mt-1 block text-sm text-muted">{ORDER_STATUS_LABEL[order.status]} · {order.customer.name} · {order.fulfilment === "pickup" ? "Hämtas" : "Skickas"}</span>
          </Link></li>
        ))}
      </ul>
    </div>
  );
}

export function OrderDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [shipFrom, setShipFrom] = useState<StoreId>("fittja");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    api<Bundle>("/api/orders")
      .then((data) => {
        if (!cancelled) setOrder(data.orders.find((item) => item.id === id) ?? null);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Fel");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (!order) return <p>{error || "Hämtar ordern…"}</p>;
  const reply = customerReply(order);
  async function setStatus(status: OrderStatus) {
    setError("");
    try {
      const data = await api<{ order: Order }>(`/api/orders/${id}`, { method: "PUT", body: JSON.stringify({ status, shipFrom }) });
      setOrder(data.order);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Fel");
    }
  }
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">{order.number}</h1>
      <p>{ORDER_STATUS_LABEL[order.status]} · {sek(order.total)}</p>
      <p className="text-sm">{order.customer.name}<br />{order.customer.phone}<br />{order.customer.address} {order.customer.postalCode} {order.customer.city}</p>
      <p className="text-sm">{order.fulfilment === "pickup" ? `Hämtas i ${order.pickupStoreId}` : "Hemleverans"}</p>
      <ul className="text-sm">{order.items.map((item) => <li key={item.productId}>{item.qty} × {item.name} · {sek(item.unitPrice * item.qty)}</li>)}</ul>
      {order.fulfilment === "delivery" && (
        <Label>Ta lagret från
          <select className="field" value={shipFrom} onChange={(event) => setShipFrom(event.target.value as StoreId)}>
            <option value="fittja">Fittja</option>
            <option value="marsta">Märsta</option>
          </select>
        </Label>
      )}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((status) => (
          <button key={status} type="button" className="rounded-full bg-paper px-3 py-2 text-sm" onClick={() => setStatus(status)}>{ORDER_STATUS_LABEL[status]}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a className="rounded-full bg-[#128C7E] py-3 text-center text-white" href={whatsappUrl(toE164(order.customer.phone), reply)} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className="rounded-full border border-line bg-paper py-3 text-center" href={smsUrl(toE164(order.customer.phone), reply)}>SMS</a>
      </div>
      {error && <p className="text-sm text-red-800">{error}</p>}
    </div>
  );
}

export function ContentForm() {
  const { data, reload } = useCatalog();
  const [content, setContent] = useState<SiteContent | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (data) setContent(structuredClone(data.content)); }, [data]);
  if (!content) return <p>Hämtar innehåll…</p>;
  function patch(partial: Partial<SiteContent>) { setContent((current) => current ? { ...current, ...partial } : current); }
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Innehåll</h1>
      <details className="rounded-3xl bg-paper p-4" open>
        <summary className="font-medium">Informationsrad</summary>
        {content.infoBar.map((item, index) => (
          <Input key={item.id} className="mt-2" value={item.text} onChange={(event) => {
            const infoBar = [...content.infoBar];
            infoBar[index] = { ...item, text: event.target.value };
            patch({ infoBar });
          }} />
        ))}
      </details>
      <details className="rounded-3xl bg-paper p-4">
        <summary className="font-medium">Hero</summary>
        {content.heroSlides.map((slide, index) => (
          <div key={slide.id} className="mt-3 space-y-2 border-t border-line pt-3">
            <img src={slide.image} alt="" className="h-24 w-full rounded-2xl object-cover" />
            <input type="file" accept="image/*" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const heroSlides = [...content.heroSlides];
              heroSlides[index] = { ...slide, image: await uploadImage(file) };
              patch({ heroSlides });
            }} />
            <Input value={slide.eyebrow} onChange={(event) => { const heroSlides = [...content.heroSlides]; heroSlides[index] = { ...slide, eyebrow: event.target.value }; patch({ heroSlides }); }} />
            <Textarea value={slide.title} onChange={(event) => { const heroSlides = [...content.heroSlides]; heroSlides[index] = { ...slide, title: event.target.value }; patch({ heroSlides }); }} />
            <Textarea value={slide.text} onChange={(event) => { const heroSlides = [...content.heroSlides]; heroSlides[index] = { ...slide, text: event.target.value }; patch({ heroSlides }); }} />
            <Input value={slide.buttonLabel} onChange={(event) => { const heroSlides = [...content.heroSlides]; heroSlides[index] = { ...slide, buttonLabel: event.target.value }; patch({ heroSlides }); }} />
            <Input value={slide.buttonHref} onChange={(event) => { const heroSlides = [...content.heroSlides]; heroSlides[index] = { ...slide, buttonHref: event.target.value }; patch({ heroSlides }); }} />
          </div>
        ))}
      </details>
      <details className="rounded-3xl bg-paper p-4">
        <summary className="font-medium">Kategorier</summary>
        {content.categories.map((tile, index) => (
          <div key={tile.id} className="mt-3 flex gap-2">
            <img src={tile.image} alt="" className="h-16 w-16 rounded-xl object-cover" />
            <div className="flex-1 space-y-2">
              <Input value={tile.name} onChange={(event) => { const categories = [...content.categories]; categories[index] = { ...tile, name: event.target.value }; patch({ categories }); }} />
              <input type="file" accept="image/*" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const categories = [...content.categories];
                categories[index] = { ...tile, image: await uploadImage(file) };
                patch({ categories });
              }} />
            </div>
          </div>
        ))}
      </details>
      <details className="rounded-3xl bg-paper p-4">
        <summary className="font-medium">Kampanjer</summary>
        {content.campaigns.map((card, index) => (
          <div key={card.id} className="mt-3 space-y-2">
            <Input value={card.title} onChange={(event) => { const campaigns = [...content.campaigns]; campaigns[index] = { ...card, title: event.target.value }; patch({ campaigns }); }} />
            <Textarea value={card.text} onChange={(event) => { const campaigns = [...content.campaigns]; campaigns[index] = { ...card, text: event.target.value }; patch({ campaigns }); }} />
            <Input value={card.buttonLabel} onChange={(event) => { const campaigns = [...content.campaigns]; campaigns[index] = { ...card, buttonLabel: event.target.value }; patch({ campaigns }); }} />
            <Input value={card.buttonHref} onChange={(event) => { const campaigns = [...content.campaigns]; campaigns[index] = { ...card, buttonHref: event.target.value }; patch({ campaigns }); }} />
            <input type="file" accept="image/*" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const campaigns = [...content.campaigns];
              campaigns[index] = { ...card, image: await uploadImage(file) };
              patch({ campaigns });
            }} />
            <button type="button" className="text-sm text-red-900" onClick={() => patch({ campaigns: content.campaigns.filter((item) => item.id !== card.id) })}>Ta bort kort</button>
          </div>
        ))}
      </details>
      <details className="rounded-3xl bg-paper p-4">
        <summary className="font-medium">Butiker</summary>
        {content.stores.map((store, index) => (
          <div key={store.id} className="mt-3 space-y-2 border-t border-line pt-3">
            <Input value={store.name} onChange={(event) => { const stores = [...content.stores]; stores[index] = { ...store, name: event.target.value }; patch({ stores }); }} />
            <Input value={store.address} onChange={(event) => { const stores = [...content.stores]; stores[index] = { ...store, address: event.target.value }; patch({ stores }); }} />
            <Input value={store.postalCity} onChange={(event) => { const stores = [...content.stores]; stores[index] = { ...store, postalCity: event.target.value }; patch({ stores }); }} />
            <Input value={store.mapsQuery} onChange={(event) => { const stores = [...content.stores]; stores[index] = { ...store, mapsQuery: event.target.value }; patch({ stores }); }} />
            {WEEKDAYS.map((day) => (
              <div key={day} className="grid grid-cols-[6rem_1fr_1fr] items-center gap-2 text-sm">
                <span>{WEEKDAY_LABELS[day]}</span>
                <Input type="time" value={store.hours[day]?.open ?? ""} onChange={(event) => {
                  const stores = [...content.stores];
                  const hours = { ...store.hours, [day]: { open: event.target.value, close: store.hours[day]?.close || "17:00" } };
                  stores[index] = { ...store, hours };
                  patch({ stores });
                }} />
                <Input type="time" value={store.hours[day]?.close ?? ""} onChange={(event) => {
                  const stores = [...content.stores];
                  const hours = { ...store.hours, [day]: { open: store.hours[day]?.open || "10:00", close: event.target.value } };
                  stores[index] = { ...store, hours };
                  patch({ stores });
                }} />
                <button type="button" className="col-span-3 text-left text-xs text-muted" onClick={() => {
                  const stores = [...content.stores];
                  stores[index] = { ...store, hours: { ...store.hours, [day]: null } };
                  patch({ stores });
                }}>Ingen öppettid</button>
              </div>
            ))}
            <Label>Extra lediga datum (ÅÅÅÅ-MM-DD, komma emellan)
              <Input value={store.closedDates.join(", ")} onChange={(event) => {
                const stores = [...content.stores];
                stores[index] = { ...store, closedDates: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) };
                patch({ stores });
              }} />
            </Label>
          </div>
        ))}
      </details>
      <Label>Telefon till butiken<Input value={content.ownerPhone} onChange={(event) => patch({ ownerPhone: event.target.value })} /></Label>
      <Label>E-post<Input value={content.footerEmail} onChange={(event) => patch({ footerEmail: event.target.value })} /></Label>
      <Label>Fri frakt från (kr)<Input type="number" value={content.freeShippingThreshold} onChange={(event) => patch({ freeShippingThreshold: Number(event.target.value) })} /></Label>
      <Label>Text om butiken<Textarea value={content.footerAbout} onChange={(event) => patch({ footerAbout: event.target.value })} /></Label>
      <Label>Meddelandemall. Platshållare: {"{{items}} {{total}} {{fulfilment}} {{customer}} {{number}}"}
        <Textarea className="min-h-48" value={content.messageTemplate} onChange={(event) => patch({ messageTemplate: event.target.value })} />
      </Label>
      {content.features.map((item, index) => (
        <Input key={item.id} value={item.text} onChange={(event) => { const features = [...content.features]; features[index] = { ...item, text: event.target.value }; patch({ features }); }} />
      ))}
      {error && <p className="text-sm text-red-800">{error}</p>}
      <Button type="button" onClick={async () => {
        try { await api("/api/content", { method: "PUT", body: JSON.stringify(content) }); reload(); }
        catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Fel"); }
      }}>Spara innehåll</Button>
    </div>
  );
}

export function SumupPage() {
  const { data } = useCatalog();
  const [status, setStatus] = useState<{ oauth: boolean; connections: { id: string; merchantName: string; merchantCode: string; keyHint: string; fromEnv?: boolean; extraMerchantCodes: string[] }[]; sumup: SumupState } | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [readers, setReaders] = useState<{ id: string; name: string; merchantCode: string }[]>([]);
  const [readerNote, setReaderNote] = useState("");
  async function load() {
    setStatus(await api("/api/sumup/status"));
  }
  useEffect(() => { load().catch((reason) => setError(reason instanceof Error ? reason.message : "Fel")); }, []);
  const sumup = status?.sumup;
  async function saveMappings(next: Partial<SumupState> & { mapPending?: { pendingId: string; productId: string }; dismissPending?: string }) {
    const data = await api<{ sumup: SumupState }>("/api/sumup/mappings", { method: "PUT", body: JSON.stringify(next) });
    setStatus((current) => current ? { ...current, sumup: data.sumup } : current);
  }
  if (!sumup || !status) return <p>{error || "Hämtar SumUp…"}</p>;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">SumUp</h1>
      <p className="text-sm text-muted">Nyckeln sparas bara på servern. Butiken fungerar även utan SumUp. Manuell försäljning finns under Sålt i butik.</p>
      <section className="rounded-3xl bg-paper p-4">
        <h2 className="font-medium">Anslut</h2>
        <Label className="mt-3">API-nyckel
          <Input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Klistra in, visas inte igen" />
        </Label>
        <Button className="mt-3" type="button" onClick={async () => {
          setError("");
          try {
            await api("/api/sumup/connect", { method: "POST", body: JSON.stringify({ apiKey }) });
            setApiKey("");
            await load();
          } catch (connectError) { setError(connectError instanceof Error ? connectError.message : "Fel"); }
        }}>Spara nyckel</Button>
        {status.oauth && <a className="mt-3 block text-sm underline" href="/api/sumup/oauth/start">Eller koppla med SumUp-inloggning</a>}
        <ul className="mt-4 space-y-2 text-sm">
          {status.connections.map((connection) => (
            <li key={connection.id} className="flex items-center justify-between gap-2">
              <span>{connection.merchantName} · {connection.merchantCode} · {connection.keyHint}</span>
              {!connection.fromEnv && <button type="button" className="text-red-900" onClick={async () => { await api("/api/sumup/connect", { method: "DELETE", body: JSON.stringify({ id: connection.id }) }); load(); }}>Ta bort</button>}
            </li>
          ))}
          {status.connections.length === 0 && <li className="text-muted">Inte anslutet.</li>}
        </ul>
      </section>
      <section className="rounded-3xl bg-paper p-4">
        <h2 className="font-medium">Vilken butik?</h2>
        <p className="mt-1 text-sm text-muted">SumUps försäljnings-API talar om vilket konto som sålde, inte vilken kortläsare. Har du ett SumUp-konto per butik blir lagret rätt.</p>
        {[...status.connections.flatMap((connection) => [connection.merchantCode, ...connection.extraMerchantCodes])].filter(Boolean).map((code) => {
          const mapping = sumup.locationMappings.find((item) => item.kind === "merchant" && item.externalId === code);
          return (
            <label key={code} className="mt-3 block text-sm">{code}
              <select className="field" value={mapping?.storeId ?? ""} onChange={(event) => {
                const storeId = event.target.value as StoreId | "";
                const locationMappings = sumup.locationMappings.filter((item) => !(item.kind === "merchant" && item.externalId === code));
                if (storeId) locationMappings.push({ id: crypto.randomUUID(), kind: "merchant", externalId: code, label: code, storeId });
                saveMappings({ locationMappings });
              }}>
                <option value="">Välj butik</option>
                <option value="fittja">Fittja</option>
                <option value="marsta">Märsta</option>
              </select>
            </label>
          );
        })}
        <button type="button" className="mt-3 text-sm underline" onClick={async () => {
          const data = await api<{ readers: { id: string; name: string; merchantCode: string }[]; note: string }>("/api/sumup/readers");
          setReaders(data.readers);
          setReaderNote(data.note);
        }}>Hämta kortläsare</button>
        {readerNote && <p className="mt-2 text-sm text-muted">{readerNote}</p>}
        {readers.map((reader) => (
          <label key={reader.id} className="mt-2 block text-sm">{reader.name} ({reader.merchantCode})
            <select className="field" value={sumup.locationMappings.find((item) => item.kind === "reader" && item.externalId === reader.id)?.storeId ?? ""} onChange={(event) => {
              const storeId = event.target.value as StoreId | "";
              const locationMappings = sumup.locationMappings.filter((item) => !(item.kind === "reader" && item.externalId === reader.id));
              if (storeId) locationMappings.push({ id: crypto.randomUUID(), kind: "reader", externalId: reader.id, label: reader.name, storeId });
              saveMappings({ locationMappings });
            }}>
              <option value="">Använd kontots butik</option>
              <option value="fittja">Fittja</option>
              <option value="marsta">Märsta</option>
            </select>
          </label>
        ))}
      </section>
      <section className="rounded-3xl bg-paper p-4">
        <h2 className="font-medium">Synka</h2>
        <Label className="mt-2">Hämta försäljning från
          <Input type="datetime-local" value={sumup.syncFrom.slice(0, 16)} onChange={(event) => saveMappings({ syncFrom: new Date(event.target.value).toISOString() })} />
        </Label>
        <p className="mt-2 text-sm text-muted">{sumup.lastSummary || "Inte synkad ännu."}{sumup.lastError ? ` Fel: ${sumup.lastError}` : ""}</p>
        <Button className="mt-3" type="button" onClick={async () => {
          setInfo(""); setError("");
          try { const report = await api<{ message: string }>("/api/sumup/sync", { method: "POST" }); setInfo(report.message); await load(); }
          catch (syncError) { setError(syncError instanceof Error ? syncError.message : "Fel"); }
        }}>Synka nu</Button>
        {info && <p className="mt-2 text-sm">{info}</p>}
      </section>
      <section className="rounded-3xl bg-paper p-4">
        <h2 className="font-medium">Omatchade varor</h2>
        <ul className="mt-3 space-y-3">
          {sumup.pending.filter((item) => item.kind === "unmatched_product" || item.kind === "weight").map((item) => (
            <PendingRow key={item.id} item={item} products={data?.products ?? []} onMap={(productId) => saveMappings({ mapPending: { pendingId: item.id, productId } })} onDismiss={() => saveMappings({ dismissPending: item.id })} />
          ))}
          {sumup.pending.filter((item) => item.kind !== "unmatched_product" && item.kind !== "weight").map((item) => (
            <li key={item.id} className="text-sm">
              <p className="font-medium">{item.name || "SumUp"}</p>
              <p className="text-muted">{item.detail}</p>
              <button type="button" className="underline" onClick={() => saveMappings({ dismissPending: item.id })}>Dölj</button>
            </li>
          ))}
          {sumup.pending.length === 0 && <li className="text-sm text-muted">Inget väntar.</li>}
        </ul>
      </section>
      {error && <p className="text-sm text-red-800">{error}</p>}
    </div>
  );
}

function PendingRow({ item, products, onMap, onDismiss }: { item: SumupPending; products: Product[]; onMap: (productId: string) => void; onDismiss: () => void }) {
  const [productId, setProductId] = useState("");
  return (
    <li className="text-sm">
      <p className="font-medium">{item.name} {item.sku && <span className="text-muted">({item.sku})</span>}</p>
      <p className="text-muted">{item.detail} · {item.quantity} st</p>
      <div className="mt-1 flex gap-2">
        <select className="field" value={productId} onChange={(event) => setProductId(event.target.value)}>
          <option value="">Välj produkt</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
        <button type="button" className="rounded-full bg-bark px-3 text-cream" onClick={() => productId && onMap(productId)}>Koppla</button>
        <button type="button" className="underline" onClick={onDismiss}>Dölj</button>
      </div>
    </li>
  );
}
