"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InlineNote, Loading, useBundle, useCatalog } from "@/components/admin/bits";
import { storeStatus } from "@/lib/hours";
import { LOW_STOCK_AT } from "@/lib/types";

export function Dashboard() {
  const catalog = useCatalog();
  const bundle = useBundle();
  const [kassa, setKassa] = useState(false);
  useEffect(() => {
    fetch("/api/sumup/status").then((response) => response.json()).then((data) => setKassa(Boolean(data.configured))).catch(() => setKassa(false));
  }, []);
  if (!catalog.data) return <Loading label="Hämtar översikten…" />;
  const low = catalog.data.products.filter((product) => product.active && (product.stock.fittja <= LOW_STOCK_AT || product.stock.marsta <= LOW_STOCK_AT));
  const fresh = (bundle.data?.orders ?? []).filter((order) => order.status === "ny");
  const today = new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Stockholm" }).format(new Date());
  const title = today.charAt(0).toUpperCase() + today.slice(1);
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-muted">{title}</p>
      <h1 className="font-display text-4xl text-ink">Hej</h1>
      <p className="mt-2 text-sm text-brown">
        {catalog.data.content.stores.map((store) => `${store.name.replace("AfroCorner ", "")}: ${storeStatus(store).label}`).join(" · ")}
      </p>
      {kassa && <p className="mt-3 text-sm text-brown">Kassan synkas automatiskt.</p>}
      {(catalog.error || bundle.error) && <div className="mt-3"><InlineNote tone="err">{catalog.error || bundle.error}</InlineNote></div>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Tile href="/admin/lager?vy=salt" title="Sålt i butik" hint="Dra av en vara nu" primary />
        <Tile href="/admin/ordrar?status=ny" title={`Nya beställningar (${fresh.length})`} hint="Bekräfta eller svara" />
        <Tile href="/admin/produkter/ny" title="Lägg till produkt" hint="Foto, pris och lager" />
        <Tile href="/admin/lager?vy=in" title="Inleverans" hint="Fyll på en butik" />
        <Tile href="/admin/produkter?filter=lagt" title={`Lite kvar i lager (${low.length})`} hint="3 eller färre i en butik" />
        <Tile href="/admin/innehall" title="Redigera startsidan" hint="Bilder och texter" />
      </div>
    </div>
  );
}

function Tile({ href, title, hint, primary = false }: { href: string; title: string; hint: string; primary?: boolean }) {
  return (
    <Link href={href} className={`flex min-h-28 flex-col justify-between rounded-3xl p-4 ${primary ? "gold-btn col-span-2 min-h-24" : "bg-paper shadow-sm"}`}>
      <span className="font-display text-2xl leading-tight">{title}</span>
      <span className={`mt-2 text-sm ${primary ? "text-bark/80" : "text-muted"}`}>{hint}</span>
    </Link>
  );
}
