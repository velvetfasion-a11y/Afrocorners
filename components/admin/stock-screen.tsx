"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { InlineNote, Loading, storeName, useBundle, useCatalog } from "@/components/admin/bits";
import { api } from "@/components/admin/api";
import { Input } from "@/components/ui/input";
import { REASON_LABEL, type Product, type ProductVariant, type StockReason, type StoreId } from "@/lib/types";

type View = "salt" | "in" | "logg";

export function StockHub({ initial = "salt" }: { initial?: View }) {
  const router = useRouter();
  const [view, setView] = useState<View>(initial);
  function choose(next: View) {
    setView(next);
    router.replace(next === "salt" ? "/admin/lager?vy=salt" : next === "in" ? "/admin/lager?vy=in" : "/admin/logg");
  }
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl">{view === "salt" ? "Sålt i butik" : view === "in" ? "Inleverans" : "Lagerlogg"}</h1>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {([["salt", "Sålt"], ["in", "Inleverans"], ["logg", "Logg"]] as const).map(([id, label]) => (
          <button key={id} type="button" className={`h-12 rounded-full text-sm ${view === id ? "bg-bark text-cream" : "bg-paper"}`} onClick={() => choose(id)}>{label}</button>
        ))}
      </div>
      <div className="mt-4">
        {view === "salt" && <PosPanel />}
        {view === "in" && <RestockPanel />}
        {view === "logg" && <LogPanel />}
      </div>
    </div>
  );
}

export function PosPage() {
  return <StockHub initial="salt" />;
}
export function StockPage() {
  return <StockHub initial="in" />;
}
export function LogPage() {
  return <StockHub initial="logg" />;
}

async function move(productId: string, storeId: StoreId, delta: number, reason: StockReason, variantId?: string) {
  await api("/api/stock", { method: "POST", body: JSON.stringify({ productId, variantId, storeId, delta, reason }) });
}

function stockRows(product: Product, storeId: StoreId) {
  if (product.variants?.length) {
    return product.variants.map((variant: ProductVariant) => ({
      key: `${product.id}:${variant.id}`,
      product,
      variantId: variant.id,
      name: `${product.name} – ${variant.label}`,
      level: variant.stock[storeId] ?? 0,
    }));
  }
  return [{ key: product.id, product, variantId: undefined as string | undefined, name: product.name, level: product.stock[storeId] ?? 0 }];
}

function StorePicker({ storeId, onChange }: { storeId: StoreId; onChange: (id: StoreId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["fittja", "marsta"] as StoreId[]).map((id) => (
        <button key={id} type="button" className={`h-12 rounded-full ${storeId === id ? "gold-btn" : "bg-paper"}`} onClick={() => onChange(id)}>{storeName(id)}</button>
      ))}
    </div>
  );
}

function useStoreChoice() {
  const [storeId, setStoreId] = useState<StoreId>("fittja");
  useEffect(() => {
    const saved = localStorage.getItem("afrocorner-pos-store");
    if (saved === "fittja" || saved === "marsta") setStoreId(saved);
  }, []);
  function choose(next: StoreId) {
    setStoreId(next);
    localStorage.setItem("afrocorner-pos-store", next);
  }
  return { storeId, choose };
}

function PosPanel() {
  const { data, reload } = useCatalog();
  const { storeId, choose } = useStoreChoice();
  const [q, setQ] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [undo, setUndo] = useState<{ productId: string; variantId?: string; name: string; amount: number } | null>(null);
  const [kassa, setKassa] = useState(false);
  useEffect(() => {
    fetch("/api/sumup/status").then((response) => response.json()).then((body) => setKassa(Boolean(body.configured))).catch(() => setKassa(false));
  }, []);
  const rows = useMemo(() => (data?.products ?? []).filter((product) => product.active !== false).flatMap((product) => stockRows(product, storeId)).filter((row) => row.name.toLowerCase().includes(q.toLowerCase())), [data, q, storeId]);
  async function sell(row: (typeof rows)[number], amount: number) {
    const sold = Math.abs(amount);
    await move(row.product.id, storeId, -sold, "in_store_sale", row.variantId);
    if (navigator.vibrate) navigator.vibrate(12);
    setUndo({ productId: row.product.id, variantId: row.variantId, name: row.name, amount: sold });
    setNote(`${row.name}: ${Math.max(0, row.level - sold)} kvar i ${storeName(storeId)}.`);
    reload();
  }
  if (!data) return <Loading label="Hämtar lagret…" />;
  return (
    <div>
      {kassa && <p className="mb-3 text-sm text-brown">Kassan synkas automatiskt.</p>}
      <StorePicker storeId={storeId} onChange={choose} />
      <Input className="mt-3 h-12" placeholder="Sök vara" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Sök vara" />
      {note && <div className="mt-3"><InlineNote>{note} {undo && <button type="button" className="underline" onClick={async () => { await move(undo.productId, storeId, undo.amount, "manual", undo.variantId); setUndo(null); setNote("Ångrat."); reload(); }}>Ångra</button>}</InlineNote></div>}
      {rows.length === 0 && <p className="mt-6 text-center text-muted">Ingen vara med det namnet.</p>}
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {rows.map((row) => (
          <li key={row.key} className="rounded-3xl bg-paper p-2">
            <img src={row.product.images[0]} alt="" className="aspect-square w-full rounded-2xl object-cover" />
            <p className="mt-2 text-sm font-medium leading-tight">{row.name}</p>
            <p className="font-display text-3xl">{row.level}</p>
            <button type="button" className="mt-2 h-12 w-full rounded-full bg-bark text-cream" onClick={() => sell(row, 1)}>−1</button>
            <div className="mt-2 flex gap-1">
              <Input className="h-12" inputMode="numeric" value={qty[row.key] ?? ""} placeholder="Antal" aria-label={`Antal ${row.name}`} onChange={(event) => setQty({ ...qty, [row.key]: event.target.value })} />
              <button type="button" className="h-12 rounded-full bg-cream-2 px-3 text-sm" onClick={() => sell(row, Math.max(1, Math.round(Number(qty[row.key] || 1))))}>Sälj</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RestockPanel() {
  const { data, reload } = useCatalog();
  const { storeId, choose } = useStoreChoice();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  if (!data) return <Loading label="Hämtar lagret…" />;
  return (
    <div>
      <p className="mb-3 text-sm text-muted">Skriv hur många som kom in och tryck Lägg till.</p>
      <StorePicker storeId={storeId} onChange={choose} />
      {note && <div className="mt-3"><InlineNote>{note}</InlineNote></div>}
      <ul className="mt-4 space-y-3">
        {data.products.filter((product) => product.active !== false).flatMap((product) => stockRows(product, storeId)).map((row) => (
          <li key={row.key} className="rounded-3xl bg-paper p-3">
            <p className="font-medium">{row.name}</p>
            <p className="text-sm text-muted">Nu: {row.level} i {storeName(storeId)}</p>
            <div className="mt-2 flex gap-2">
              <Input className="h-12" inputMode="numeric" placeholder="Antal" aria-label={`Inleverans ${row.name}`} value={amounts[row.key] ?? ""} onChange={(event) => setAmounts({ ...amounts, [row.key]: event.target.value })} />
              <button type="button" className="gold-btn h-12 shrink-0 rounded-full px-4" onClick={async () => {
                const qty = Math.round(Number(amounts[row.key]));
                if (!qty) return;
                await move(row.product.id, storeId, qty, "restock", row.variantId);
                setAmounts({ ...amounts, [row.key]: "" });
                setNote(`${qty} ${row.name} lades till i ${storeName(storeId)}.`);
                reload();
              }}>Lägg till</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LogPanel() {
  const { data } = useBundle();
  const [store, setStore] = useState<"" | StoreId>("");
  const [reason, setReason] = useState<"" | StockReason>("");
  if (!data) return <Loading label="Hämtar loggen…" />;
  const rows = data.logs.filter((entry) => (!store || entry.storeId === store) && (!reason || entry.reason === reason));
  return (
    <div>
      <p className="mb-3 text-sm text-muted">Här syns butiksförsäljning, inleverans och SumUp. Kassan synkas automatiskt när den är igång.</p>
      <div className="grid grid-cols-2 gap-2">
        <select className="field h-12" value={store} aria-label="Butik" onChange={(event) => setStore(event.target.value as "" | StoreId)}>
          <option value="">Alla butiker</option>
          <option value="fittja">Fittja</option>
          <option value="marsta">Märsta</option>
        </select>
        <select className="field h-12" value={reason} aria-label="Orsak" onChange={(event) => setReason(event.target.value as "" | StockReason)}>
          <option value="">Alla orsaker</option>
          {Object.entries(REASON_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      {rows.length === 0 && <p className="mt-6 text-center text-muted">Ingen ändring ännu.</p>}
      <ul className="mt-4 space-y-2">
        {rows.map((entry) => (
          <li key={entry.id} className="rounded-2xl bg-paper px-3 py-3">
            <p className="font-medium">{entry.productName} <span className={entry.change < 0 ? "text-red-900" : "text-[#1d4d32]"}>{entry.change > 0 ? `+${entry.change}` : entry.change}</span></p>
            <p className="text-sm text-muted">{new Date(entry.createdAt).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })} · {storeName(entry.storeId)} · {REASON_LABEL[entry.reason]}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
