"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoPicker } from "@/components/admin/crop";
import { InlineNote, Loading, Stepper, moveItem, useCatalog, useWarnIfDirty } from "@/components/admin/bits";
import { useAdminDirty } from "@/components/admin/shell";
import { api } from "@/components/admin/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { sek, unitPrice } from "@/lib/format";
import { CATEGORY_LABEL, LOW_STOCK_AT, type CategoryId, type Product } from "@/lib/types";

function readParam(name: string) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

export function ProductList() {
  const { data, reload } = useCatalog();
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<string>("alla");
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);
  useEffect(() => {
    if (readParam("filter") === "lagt") setChip("lagt");
  }, []);
  const products = useMemo(() => {
    const list = [...(data?.products ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "sv"));
    return list.filter((product) => {
      const hay = `${product.name} ${product.sku}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (chip === "lagt") return product.stock.fittja <= LOW_STOCK_AT || product.stock.marsta <= LOW_STOCK_AT;
      if (chip !== "alla") return product.category === chip;
      return true;
    });
  }, [data, q, chip]);

  async function reorder(from: number, to: number) {
    const next = moveItem(products, from, to);
    if (next === products) return;
    setNote("");
    await Promise.all(next.map((product, index) => api(`/api/products/${product.id}`, { method: "PUT", body: JSON.stringify({ ...product, sortOrder: (index + 1) * 10 }) })));
    setNote("Ordningen är sparad.");
    reload();
  }

  if (!data) return <Loading label="Hämtar produkter…" />;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl">Produkter</h1>
        <Link href="/admin/produkter/ny" className="gold-btn flex h-12 items-center rounded-full px-4 text-sm">Ny vara</Link>
      </div>
      <p className="mt-1 text-sm text-muted">Tryck på en vara för att ändra den. Dra i handtaget för att byta ordning.</p>
      <Input className="mt-4 h-12" placeholder="Sök namn eller SKU" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Sök produkter" />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {[["alla", "Alla"], ["lagt", "Lite kvar"], ...Object.entries(CATEGORY_LABEL)].map(([id, label]) => (
          <button key={id} type="button" className={`h-11 shrink-0 rounded-full px-4 text-sm ${chip === id ? "bg-bark text-cream" : "bg-paper"}`} onClick={() => setChip(id)}>{label}</button>
        ))}
      </div>
      {note && <div className="mt-3"><InlineNote>{note}</InlineNote></div>}
      {products.length === 0 && <p className="mt-6 rounded-3xl bg-paper px-4 py-8 text-center text-muted">Inga varor här. Lägg till en vara med knappen ovan.</p>}
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {products.map((product, index) => (
          <li
            key={product.id}
            className="rounded-3xl bg-paper p-2"
            onPointerDown={(event) => {
              if (!(event.target as HTMLElement).dataset.handle) return;
              setDragging(index);
              (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (dragging === null) return;
              const cards = [...event.currentTarget.parentElement!.children];
              const hit = cards.findIndex((card) => {
                const box = card.getBoundingClientRect();
                return event.clientY >= box.top && event.clientY <= box.bottom && event.clientX >= box.left && event.clientX <= box.right;
              });
              if (hit >= 0 && hit !== dragging) {
                setDragging(hit);
                reorder(dragging, hit);
              }
            }}
            onPointerUp={() => setDragging(null)}
          >
            <Link href={`/admin/produkter/${product.id}`} className="block">
              <img src={product.images[0] || "/images/cat-skonhet.jpg"} alt="" className="aspect-square w-full rounded-2xl object-cover" />
              <span className="mt-2 block font-medium leading-tight">{product.name}</span>
              <span className="mt-1 block text-sm text-muted">{sek(unitPrice(product))}</span>
              <span className="mt-1 block text-xs text-brown">Fittja {product.stock.fittja} · Märsta {product.stock.marsta}</span>
            </Link>
            <button type="button" data-handle="1" className="mt-2 h-11 w-full rounded-full bg-cream text-sm" aria-label={`Flytta ${product.name}`}>Håll och dra</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const EMPTY: Product = {
  id: "", slug: "", sku: "", name: "", description: "", price: 0, salePrice: null, badge: "",
  category: "harvard", images: [], offer: false, news: false, sortOrder: 50,
  stock: { fittja: 0, marsta: 0 }, active: true,
};

export function ProductForm({ id }: { id: string }) {
  const router = useRouter();
  const { setDirty } = useAdminDirty();
  const [product, setProduct] = useState<Product>(EMPTY);
  const [baseline, setBaseline] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(id !== "ny");
  const dirty = baseline !== "" && JSON.stringify(product) !== baseline;
  useWarnIfDirty(dirty);
  useEffect(() => { setDirty(dirty); }, [dirty, setDirty]);

  useEffect(() => {
    if (id === "ny") {
      setBaseline(JSON.stringify(EMPTY));
      return;
    }
    fetch("/api/catalog").then((response) => response.json()).then((data) => {
      const found = (data.products as Product[]).find((item) => item.id === id);
      if (found) {
        setProduct(found);
        setBaseline(JSON.stringify(found));
      }
      setLoading(false);
    });
  }, [id]);

  function patch(partial: Partial<Product>) {
    setSaved("");
    setProduct((current) => ({ ...current, ...partial }));
  }

  async function save() {
    setError("");
    try {
      const path = id === "ny" ? "/api/products" : `/api/products/${id}`;
      const method = id === "ny" ? "POST" : "PUT";
      const data = await api<{ product: Product }>(path, { method, body: JSON.stringify(product) });
      setProduct(data.product);
      setBaseline(JSON.stringify(data.product));
      setSaved("Sparat.");
      if (id === "ny") router.replace(`/admin/produkter/${data.product.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunde inte spara.");
    }
  }

  if (loading) return <Loading label="Hämtar varan…" />;
  return (
    <div className="mx-auto max-w-xl pb-36">
      <h1 className="font-display text-4xl">{id === "ny" ? "Ny vara" : "Ändra vara"}</h1>
      <p className="mt-1 text-sm text-muted">Fyll i det kunden ska se, och hur många som finns i varje butik.</p>
      <div className="mt-4 space-y-3">
        <Label>Namn<Input className="h-12" value={product.name} onChange={(event) => patch({ name: event.target.value })} /></Label>
        <Label>SKU
          <Input className="h-12" value={product.sku} onChange={(event) => patch({ sku: event.target.value })} />
          <span className="mt-1 block text-sm font-normal text-muted">Samma kod som i kassan, om ni använder SumUp. Då kopplas försäljningen automatiskt.</span>
        </Label>
        <Label>Beskrivning<Textarea value={product.description} onChange={(event) => patch({ description: event.target.value })} /></Label>
        <div className="grid grid-cols-2 gap-3">
          <Label>Pris (kr)<Input className="h-12" inputMode="numeric" type="number" value={product.price} onChange={(event) => patch({ price: Number(event.target.value) })} /></Label>
          <Label>Reapris
            <Input className="h-12" inputMode="numeric" type="number" value={product.salePrice ?? ""} placeholder="Inget" onChange={(event) => patch({ salePrice: event.target.value === "" ? null : Number(event.target.value) })} />
          </Label>
        </div>
        <Label>Märke på bilden
          <Input className="h-12" value={product.badge} placeholder="−20% eller 2 för 1" onChange={(event) => patch({ badge: event.target.value })} />
          <span className="mt-1 block text-sm font-normal text-muted">Lämna tomt så räknas procenten ut från reapriset.</span>
        </Label>
        <Label>Kategori
          <select className="field h-12" value={product.category} onChange={(event) => patch({ category: event.target.value as CategoryId })}>
            {Object.entries(CATEGORY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Stepper label="Fittja" value={product.stock.fittja} onChange={(value) => patch({ stock: { ...product.stock, fittja: value } })} />
          <Stepper label="Märsta" value={product.stock.marsta} onChange={(value) => patch({ stock: { ...product.stock, marsta: value } })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Toggle on={product.offer} label="Erbjudande" onClick={() => patch({ offer: !product.offer })} />
          <Toggle on={product.news} label="Nyhet" onClick={() => patch({ news: !product.news })} />
        </div>
        <Toggle on={product.active} label="Syns i butiken" onClick={() => patch({ active: !product.active })} />
        <div>
          <p className="mb-2 text-sm font-medium text-brown">Bilder</p>
          <div className="flex gap-2 overflow-x-auto">
            {product.images.map((image, index) => (
              <div key={`${image}-${index}`} className="relative shrink-0">
                <img src={image} alt="" className="h-28 w-28 rounded-2xl object-cover" />
                <button type="button" className="absolute right-1 top-1 h-8 rounded-full bg-bark px-2 text-xs text-cream" onClick={() => patch({ images: product.images.filter((_, imageIndex) => imageIndex !== index) })}>Ta bort</button>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <PhotoPicker onUploaded={(url) => patch({ images: [...product.images, url] })} />
          </div>
        </div>
      </div>
      {error && <div className="mt-3"><InlineNote tone="err">{error}</InlineNote></div>}
      {id !== "ny" && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="h-12 rounded-full border border-line bg-paper" onClick={async () => {
            const data = await api<{ product: Product }>("/api/products", { method: "POST", body: JSON.stringify({ ...product, id: "", name: `Kopia av ${product.name}`, slug: "" }) });
            router.push(`/admin/produkter/${data.product.id}`);
          }}>Duplicera</button>
          <button type="button" className="h-12 rounded-full border border-red-200 text-red-900" onClick={() => setConfirm(true)}>Ta bort</button>
        </div>
      )}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-paper/95 p-3 md:bottom-0 md:left-60">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-brown">{saved || (dirty ? "Osparade ändringar" : "Allt är sparat")}</p>
          <button type="button" className="gold-btn h-12 shrink-0 rounded-full px-6" onClick={save}>Spara</button>
        </div>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>Ta bort varan?</DialogTitle>
          <p className="mt-2 text-sm text-muted">Kunden ser den inte längre. Det går inte att ångra.</p>
          <button type="button" className="mt-4 h-12 w-full rounded-full bg-red-900 text-white" onClick={async () => { await api(`/api/products/${id}`, { method: "DELETE" }); setDirty(false); router.push("/admin/produkter"); }}>Ja, ta bort</button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`flex h-12 items-center justify-between rounded-full px-4 text-sm ${on ? "bg-bark text-cream" : "bg-paper"}`}>
      {label}
      <span>{on ? "På" : "Av"}</span>
    </button>
  );
}
