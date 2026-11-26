"use client";

import { useEffect, useState } from "react";
import { InlineNote, Loading } from "@/components/admin/bits";

type DevData = {
  accounts: { storeId?: string; merchantCode: string; keyHint: string }[];
  pending: { id: string; name: string; sku: string; quantity: number; detail: string; kind: string }[];
  products: { id: string; name: string; sku: string }[];
  lastSummary: string;
  lastError: string | null;
  lastSyncAt: string | null;
};

export function DevScreen() {
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<DevData | null>(null);
  const [note, setNote] = useState("");

  async function load() {
    const response = await fetch("/api/dev/sumup");
    if (response.status === 403) {
      setDenied(true);
      return;
    }
    if (!response.ok) {
      setError("Kunde inte öppna utvecklarvyn.");
      return;
    }
    setData(await response.json());
  }

  useEffect(() => { load().catch((reason) => setError(reason instanceof Error ? reason.message : "Fel")); }, []);

  if (denied) {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-paper p-5">
        <h1 className="font-display text-3xl">Ingen behörighet</h1>
        <p className="mt-2 text-sm text-muted">Den här sidan är bara för utvecklarens Google-konto.</p>
      </div>
    );
  }
  if (!data) return error ? <InlineNote tone="err">{error}</InlineNote> : <Loading label="Hämtar…" />;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-4xl">SumUp, utvecklare</h1>
      <p className="text-sm text-muted">Nycklarna ligger i miljövariabler. Här syns bara effekten och sådant som inte kunde kopplas automatiskt.</p>
      <ul className="space-y-2">
        {data.accounts.length === 0 && <li className="text-sm text-muted">Inga SUMUP_* nycklar är satta.</li>}
        {data.accounts.map((account) => (
          <li key={`${account.storeId}-${account.merchantCode}`} className="rounded-2xl bg-paper p-3 text-sm">{account.storeId} · {account.merchantCode} · {account.keyHint}</li>
        ))}
      </ul>
      <p className="text-sm">{data.lastSummary || "Inte synkad ännu."}{data.lastError ? ` Fel: ${data.lastError}` : ""}</p>
      {note && <InlineNote>{note}</InlineNote>}
      <button type="button" className="gold-btn h-12 rounded-full px-5" onClick={async () => {
        const response = await fetch("/api/dev/sumup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync" }) });
        const body = await response.json();
        setNote(body.message || body.error || "Synk klar.");
        await load();
      }}>Synka nu</button>
      <h2 className="font-display text-2xl">Omatchade rader</h2>
      {data.pending.length === 0 && <p className="text-sm text-muted">Inget väntar. SKU och namn kopplas automatiskt.</p>}
      <ul className="space-y-3">
        {data.pending.map((item) => <Pending key={item.id} item={item} products={data.products} onChange={load} />)}
      </ul>
    </div>
  );
}

function Pending({ item, products, onChange }: { item: DevRow; products: { id: string; name: string }[]; onChange: () => Promise<void> }) {
  const [productId, setProductId] = useState("");
  return (
    <li className="rounded-2xl bg-paper p-3 text-sm">
      <p className="font-medium">{item.name || "SumUp"} {item.sku && `(${item.sku})`}</p>
      <p className="text-muted">{item.detail}</p>
      <div className="mt-2 flex gap-2">
        <select className="field h-12" value={productId} aria-label="Koppla produkt" onChange={(event) => setProductId(event.target.value)}>
          <option value="">Välj produkt</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
        <button type="button" className="h-12 rounded-full bg-bark px-3 text-cream" onClick={async () => {
          if (!productId) return;
          await fetch("/api/dev/sumup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "map", pendingId: item.id, productId }) });
          await onChange();
        }}>Koppla</button>
      </div>
    </li>
  );
}

type DevRow = { id: string; name: string; sku: string; detail: string };
