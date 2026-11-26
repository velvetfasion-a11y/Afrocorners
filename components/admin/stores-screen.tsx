"use client";

import { useEffect, useState } from "react";
import { InlineNote, Loading, useCatalog, useWarnIfDirty } from "@/components/admin/bits";
import { useAdminDirty } from "@/components/admin/shell";
import { api } from "@/components/admin/api";
import { Input, Label } from "@/components/ui/input";
import { WEEKDAYS, WEEKDAY_LABELS, type SiteContent, type StoreId, type StoreLocation } from "@/lib/types";

export function StoresScreen() {
  const { data, reload } = useCatalog();
  const { setDirty } = useAdminDirty();
  const [content, setContent] = useState<SiteContent | null>(null);
  const [baseline, setBaseline] = useState("");
  const [storeId, setStoreId] = useState<StoreId>("fittja");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [date, setDate] = useState("");
  const dirty = Boolean(content && baseline && JSON.stringify(content.stores) !== baseline);
  useWarnIfDirty(dirty);
  useEffect(() => { setDirty(dirty); }, [dirty, setDirty]);
  useEffect(() => {
    if (!data) return;
    const copy = structuredClone(data.content);
    setContent(copy);
    setBaseline(JSON.stringify(copy.stores));
  }, [data]);
  if (!content) return <Loading label="Hämtar butikerna…" />;
  const index = content.stores.findIndex((store) => store.id === storeId);
  const store = content.stores[index];

  function update(next: StoreLocation) {
    setSaved("");
    const stores = [...content!.stores];
    stores[index] = next;
    setContent({ ...content!, stores });
  }

  async function save() {
    if (!content) return;
    setError("");
    try {
      await api("/api/content", { method: "PUT", body: JSON.stringify(content) });
      setBaseline(JSON.stringify(content.stores));
      setSaved("Öppettiderna är sparade.");
      reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunde inte spara.");
    }
  }

  return (
    <div className="mx-auto max-w-xl pb-28">
      <h1 className="font-display text-4xl">Butiker</h1>
      <p className="mt-1 text-sm text-muted">Adress och tider visas i menyn, sidfoten och på Hitta oss. Kunderna ser när ni öppnar igen.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {content.stores.map((item) => (
          <button key={item.id} type="button" className={`h-12 rounded-full ${storeId === item.id ? "bg-bark text-cream" : "bg-paper"}`} onClick={() => setStoreId(item.id)}>{item.name.replace("AfroCorner ", "")}</button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        <Label>Namn<Input className="h-12" value={store.name} onChange={(event) => update({ ...store, name: event.target.value })} /></Label>
        <Label>Gatuadress<Input className="h-12" value={store.address} onChange={(event) => update({ ...store, address: event.target.value })} /></Label>
        <Label>Postnummer och ort<Input className="h-12" value={store.postalCity} onChange={(event) => update({ ...store, postalCity: event.target.value })} /></Label>
        <Label>Sökord till kartan<Input className="h-12" value={store.mapsQuery} onChange={(event) => update({ ...store, mapsQuery: event.target.value })} /></Label>
      </div>
      <h2 className="mt-6 font-display text-2xl">Veckan</h2>
      <ul className="mt-3 space-y-3">
        {WEEKDAYS.map((day) => {
          const hours = store.hours[day];
          return (
            <li key={day} className="rounded-3xl bg-paper p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{WEEKDAY_LABELS[day]}</span>
                <button
                  type="button"
                  className={`h-11 rounded-full px-4 text-sm ${hours ? "bg-[#e5f0e6] text-[#1d4d32]" : "bg-cream-2"}`}
                  aria-pressed={!hours}
                  onClick={() => {
                    const nextHours: StoreLocation["hours"] = { ...store.hours, [day]: hours ? null : { open: "10:00", close: "18:00" } };
                    update({ ...store, hours: nextHours });
                  }}
                >
                  {hours ? "Öppet" : "Stängt"}
                </button>
              </div>
              {hours && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Label>Öppnar<input className="field h-12" type="time" value={hours.open} onChange={(event) => update({ ...store, hours: { ...store.hours, [day]: { ...hours, open: event.target.value } } })} /></Label>
                  <Label>Stänger<input className="field h-12" type="time" value={hours.close} onChange={(event) => update({ ...store, hours: { ...store.hours, [day]: { ...hours, close: event.target.value } } })} /></Label>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <h2 className="mt-6 font-display text-2xl">Helgdagar</h2>
      <p className="mt-1 text-sm text-muted">En extra dag då butiken har stängt, till exempel en röd dag.</p>
      <div className="mt-3 flex gap-2">
        <Input className="h-12" type="date" value={date} aria-label="Ledig dag" onChange={(event) => setDate(event.target.value)} />
        <button type="button" className="h-12 shrink-0 rounded-full bg-bark px-4 text-sm text-cream" onClick={() => {
          if (!date || store.closedDates.includes(date)) return;
          update({ ...store, closedDates: [...store.closedDates, date].sort() });
          setDate("");
        }}>Lägg till</button>
      </div>
      <ul className="mt-3 space-y-2">
        {store.closedDates.length === 0 && <li className="text-sm text-muted">Inga extra lediga dagar.</li>}
        {store.closedDates.map((day) => (
          <li key={day} className="flex items-center justify-between rounded-2xl bg-paper px-3 py-2">
            <span>{day}</span>
            <button type="button" className="h-11 px-3 text-sm underline" onClick={() => update({ ...store, closedDates: store.closedDates.filter((item) => item !== day) })}>Ta bort</button>
          </li>
        ))}
      </ul>
      {error && <div className="mt-3"><InlineNote tone="err">{error}</InlineNote></div>}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-paper/95 p-3 md:bottom-0 md:left-60">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <p className="flex-1 text-sm">{saved || (dirty ? "Osparade ändringar" : "Allt är sparat")}</p>
          <button type="button" className="gold-btn h-12 rounded-full px-6" onClick={save}>Spara butiker</button>
        </div>
      </div>
    </div>
  );
}
