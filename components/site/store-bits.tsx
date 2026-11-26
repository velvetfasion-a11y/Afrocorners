"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { mapsDirectionsUrl, storeStatus, weeklyHoursSummary } from "@/lib/hours";
import type { StoreLocation } from "@/lib/types";

export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

export function StoreLines({ store, compact = false }: { store: StoreLocation; compact?: boolean }) {
  const now = useNow();
  const status = storeStatus(store, now);
  return (
    <div className={compact ? "text-sm" : ""}>
      <p className="font-medium text-ink">{store.name.replace("AfroCorner ", "")}</p>
      <p className="text-muted">{store.address}, {store.postalCity}</p>
      <p className={status.open ? "text-good" : "text-gold-deep"}>{status.label}</p>
      {!compact && <p className="text-sm text-muted">Idag {status.todayHours}</p>}
      <a className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brown underline-offset-2 hover:underline" href={mapsDirectionsUrl(store.mapsQuery)} target="_blank" rel="noreferrer">
        <MapPin className="h-3.5 w-3.5" /> Hitta hit
      </a>
    </div>
  );
}

export function StoreCard({ store, now, dense = false }: { store: StoreLocation; now: Date; dense?: boolean }) {
  const status = storeStatus(store, now);
  const week = weeklyHoursSummary(store.hours);
  const today = status.todayHours === "Ingen öppettid" ? "stängt" : status.todayHours;
  return (
    <article className={`rounded-2xl border border-[#e4d3b4] bg-[#FFFFFF] text-left shadow-[0_1px_0_rgba(42,28,18,0.04)] ${dense ? "p-3" : "p-4 sm:p-5"}`}>
      <h3 className="font-display text-xl leading-none text-bark">{store.name.replace("AfroCorner ", "")}</h3>
      <p className="mt-1.5 text-sm text-muted">{store.address}, {store.postalCity}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.open ? "bg-[#e5f0e6] text-[#1d4d32]" : "bg-[#f6e4e0] text-[#8a4036]"}`}>
          {status.open ? "Öppen nu" : "Stängt"}
        </span>
        <span className="text-sm text-ink">Idag {today}</span>
      </div>
      {!status.open && <p className="mt-1 text-sm text-muted">{status.label}</p>}
      <p className="mt-2 text-sm leading-5 text-brown">
        {week.map((span, index) => (
          <span key={span.label}>
            {index > 0 && <span className="text-muted"> · </span>}
            <span className="text-muted">{span.label}</span> {span.hours}
          </span>
        ))}
      </p>
      <a className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brown underline-offset-2 hover:underline" href={mapsDirectionsUrl(store.mapsQuery)} target="_blank" rel="noreferrer">
        <MapPin className="h-3.5 w-3.5" /> Hitta hit
      </a>
    </article>
  );
}
