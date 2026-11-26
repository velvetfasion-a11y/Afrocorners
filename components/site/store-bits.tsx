"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { mapsDirectionsUrl, storeStatus } from "@/lib/hours";
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
