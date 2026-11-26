"use client";

import { useEffect, useState } from "react";
import { InlineNote, Loading } from "@/components/admin/bits";
import { api } from "@/components/admin/api";
import { Input, Label } from "@/components/ui/input";
import { OFFER_TITLES, type OfferKind, type OfferUnit, type ShopOffer } from "@/lib/offers";

const HINT: Record<OfferKind, string> = {
  new_customer: "Procent eller kronor på den första ordern.",
  loyal: "Kronor eller procent när kontot är tillräckligt gammalt.",
  everyone: "För alla som är inloggade.",
};

export function OffersScreen() {
  const [offers, setOffers] = useState<ShopOffer[] | null>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ offers: ShopOffer[] }>("/api/offers").then((data) => setOffers(data.offers)).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Kunde inte hämta erbjudanden.");
    });
  }, []);

  function patch(kind: OfferKind, partial: Partial<ShopOffer>) {
    setSaved("");
    setOffers((current) => current?.map((offer) => offer.kind === kind ? { ...offer, ...partial } : offer) ?? current);
  }

  async function save() {
    if (!offers) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<{ offers: ShopOffer[] }>("/api/offers", { method: "PUT", body: JSON.stringify({ offers }) });
      setOffers(data.offers);
      setSaved("Erbjudandena är sparade.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunde inte spara.");
    } finally {
      setBusy(false);
    }
  }

  if (!offers) return <Loading label="Hämtar erbjudanden…" />;

  return (
    <div className="mx-auto max-w-xl pb-28">
      <h1 className="font-display text-4xl">Erbjudanden</h1>
      <p className="mt-2 text-sm text-muted">Tre färdiga rabatter för inloggade kunder. Om flera passar används den som ger mest. Kunden betalar fortfarande via länken ni skickar.</p>
      <div className="mt-4 grid gap-2">
        {offers.map((offer) => (
          <button
            key={offer.kind}
            type="button"
            className="h-14 rounded-full bg-paper px-4 text-left text-sm font-medium"
            onClick={() => patch(offer.kind, { enabled: true })}
          >
            Slå på: {OFFER_TITLES[offer.kind]}
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-4">
        {offers.map((offer) => (
          <article key={offer.kind} className="rounded-3xl border border-[#e4d3b4] bg-[#fbf6ee] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">{offer.title}</h2>
                <p className="mt-1 text-sm text-muted">{HINT[offer.kind]}</p>
              </div>
              <button
                type="button"
                aria-pressed={offer.enabled}
                className={`h-12 shrink-0 rounded-full px-4 text-sm font-medium ${offer.enabled ? "bg-[#e5f0e6] text-[#1d4d32]" : "bg-cream-2 text-muted"}`}
                onClick={() => patch(offer.kind, { enabled: !offer.enabled })}
              >
                {offer.enabled ? "På" : "Av"}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Label>Typ
                <select className="field h-12" value={offer.unit} onChange={(event) => patch(offer.kind, { unit: event.target.value as OfferUnit })}>
                  <option value="percent">Procent</option>
                  <option value="kr">Kronor</option>
                </select>
              </Label>
              <Label>{offer.unit === "percent" ? "Procent" : "Kronor"}
                <Input className="h-12" inputMode="numeric" value={offer.amount} onChange={(event) => patch(offer.kind, { amount: Number(event.target.value) })} />
              </Label>
              <Label>Minsta order (kr)
                <Input className="h-12" inputMode="numeric" value={offer.minOrder} onChange={(event) => patch(offer.kind, { minOrder: Number(event.target.value) })} />
              </Label>
              {offer.kind === "loyal" && (
                <Label>Minst antal dagar
                  <Input className="h-12" inputMode="numeric" value={offer.minAccountDays} onChange={(event) => patch(offer.kind, { minAccountDays: Number(event.target.value) })} />
                </Label>
              )}
              <Label>Start
                <Input className="h-12" type="date" value={offer.startsOn} onChange={(event) => patch(offer.kind, { startsOn: event.target.value })} />
              </Label>
              <Label>Slut
                <Input className="h-12" type="date" value={offer.endsOn} onChange={(event) => patch(offer.kind, { endsOn: event.target.value })} />
              </Label>
            </div>
          </article>
        ))}
      </div>
      {error && <div className="mt-3"><InlineNote tone="err">{error}</InlineNote></div>}
      {saved && <div className="mt-3"><InlineNote>{saved}</InlineNote></div>}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-paper/95 p-3 md:bottom-0 md:left-60">
        <button type="button" disabled={busy} className="gold-btn mx-auto block h-12 w-full max-w-xl rounded-full disabled:opacity-60" onClick={save}>Spara erbjudanden</button>
      </div>
    </div>
  );
}
