"use client";

import { useEffect, useState } from "react";
import { StockHub } from "@/components/admin/stock-screen";

export default function Page() {
  const [view, setView] = useState<"salt" | "in" | "logg" | null>(null);
  useEffect(() => {
    const vy = new URLSearchParams(window.location.search).get("vy");
    setView(vy === "in" || vy === "logg" ? vy : "salt");
  }, []);
  if (!view) return <p className="text-muted">Hämtar lagret…</p>;
  return <StockHub initial={view} />;
}
