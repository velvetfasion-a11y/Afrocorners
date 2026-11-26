"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";
import type { Order, Product, SiteContent, StockLogEntry, StoreId, SumupState } from "@/lib/types";

export type Bundle = { orders: Order[]; logs: StockLogEntry[]; sumup: SumupState };
export type Catalog = { products: Product[]; content: SiteContent };

export function useCatalog() {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  async function reload() {
    const response = await fetch("/api/catalog");
    if (!response.ok) throw new Error("Kunde inte hämta butiken.");
    const json = await response.json();
    setData({ products: json.products, content: json.content });
  }
  useEffect(() => {
    reload().catch((reason) => setError(reason instanceof Error ? reason.message : "Något gick fel."));
  }, []);
  return { data, error, reload };
}

export function useBundle() {
  const [data, setData] = useState<Bundle | null>(null);
  const [error, setError] = useState("");
  async function reload() {
    setData(await api<Bundle>("/api/orders"));
  }
  useEffect(() => {
    reload().catch((reason) => setError(reason instanceof Error ? reason.message : "Något gick fel."));
  }, []);
  return { data, error, reload };
}

export function Loading({ label = "Hämtar…" }: { label?: string }) {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="h-8 w-40 animate-pulse rounded-full bg-cream-2" />
      <div className="h-28 animate-pulse rounded-3xl bg-cream-2" />
      <div className="h-28 animate-pulse rounded-3xl bg-cream-2" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export function InlineNote({ tone = "ok", children }: { tone?: "ok" | "warn" | "err"; children: React.ReactNode }) {
  const toneClass = tone === "err" ? "bg-red-100 text-red-950" : tone === "warn" ? "bg-[#f3e2b8] text-bark" : "bg-[#e5f0e6] text-[#1d4d32]";
  return (
    <p className={`rounded-2xl px-3 py-3 text-sm ${toneClass}`} role="status">
      {children}
    </p>
  );
}

export function Stepper({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="rounded-3xl bg-paper p-3">
      <p className="text-sm font-medium text-brown">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <button type="button" className="grid h-12 w-12 place-items-center rounded-full bg-cream-2 text-2xl" aria-label={`Minska ${label}`} onClick={() => onChange(Math.max(0, value - 1))}>
          −
        </button>
        <span className="min-w-12 text-center font-display text-4xl">{value}</span>
        <button type="button" className="grid h-12 w-12 place-items-center rounded-full bg-cream-2 text-2xl" aria-label={`Öka ${label}`} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

export function useWarnIfDirty(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function storeName(id: StoreId) {
  return id === "fittja" ? "Fittja" : "Märsta";
}
