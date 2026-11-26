export type OfferKind = "new_customer" | "loyal" | "everyone";
export type OfferUnit = "percent" | "kr";

export interface ShopOffer {
  id: OfferKind;
  kind: OfferKind;
  title: string;
  enabled: boolean;
  unit: OfferUnit;
  amount: number;
  /** 0 means no minimum. */
  minOrder: number;
  /** Used by the loyal offer. Default 7. */
  minAccountDays: number;
  /** YYYY-MM-DD in Europe/Stockholm, or empty. */
  startsOn: string;
  endsOn: string;
}

export interface CustomerProfile {
  uid: string;
  email: string;
  name: string;
  favorites: string[];
  createdAt: string;
  firstOrderAt: string | null;
  orderCount: number;
}

export interface AppliedOffer {
  offerId: OfferKind;
  title: string;
  unit: OfferUnit;
  amount: number;
  /** Kronor taken off the merchandise total. */
  discount: number;
}

export const OFFER_TITLES: Record<OfferKind, string> = {
  new_customer: "Rabatt för nya kunder",
  loyal: "Tack för att du är kund",
  everyone: "Rabatt till alla inloggade",
};

const KINDS: OfferKind[] = ["new_customer", "loyal", "everyone"];

export function defaultOffers(): ShopOffer[] {
  return [
    { id: "new_customer", kind: "new_customer", title: OFFER_TITLES.new_customer, enabled: false, unit: "percent", amount: 10, minOrder: 0, minAccountDays: 0, startsOn: "", endsOn: "" },
    { id: "loyal", kind: "loyal", title: OFFER_TITLES.loyal, enabled: false, unit: "kr", amount: 50, minOrder: 0, minAccountDays: 7, startsOn: "", endsOn: "" },
    { id: "everyone", kind: "everyone", title: OFFER_TITLES.everyone, enabled: false, unit: "percent", amount: 5, minOrder: 0, minAccountDays: 0, startsOn: "", endsOn: "" },
  ];
}

export function stockholmDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function accountAgeDays(createdAt: string, today: string): number {
  const created = stockholmDate(new Date(createdAt));
  const start = Date.parse(`${created}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function mergeFavorites(remote: string[], local: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...remote, ...local]) {
    if (typeof id !== "string" || id.length < 1 || id.length > 80 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 100) break;
  }
  return out;
}

function dateOk(value: string): boolean {
  return value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function clampOffer(kind: OfferKind, input: Partial<ShopOffer> | undefined, base: ShopOffer): ShopOffer {
  const unit: OfferUnit = input?.unit === "kr" || input?.unit === "percent" ? input.unit : base.unit;
  const rawAmount = Number(input?.amount);
  const amountCap = unit === "percent" ? 100 : 5000;
  const amount = Number.isFinite(rawAmount) ? Math.min(amountCap, Math.max(1, Math.round(rawAmount))) : base.amount;
  const rawMin = Number(input?.minOrder);
  const minOrder = Number.isFinite(rawMin) ? Math.min(100_000, Math.max(0, Math.round(rawMin))) : 0;
  const rawDays = Number(input?.minAccountDays);
  const minAccountDays = kind === "loyal"
    ? (Number.isFinite(rawDays) ? Math.min(3650, Math.max(0, Math.round(rawDays))) : 7)
    : 0;
  const startsOn = dateOk(input?.startsOn ?? "") ? (input?.startsOn ?? "") : "";
  const endsOn = dateOk(input?.endsOn ?? "") ? (input?.endsOn ?? "") : "";
  return {
    id: kind,
    kind,
    title: OFFER_TITLES[kind],
    enabled: Boolean(input?.enabled),
    unit,
    amount,
    minOrder,
    minAccountDays,
    startsOn: startsOn && endsOn && endsOn < startsOn ? "" : startsOn,
    endsOn: startsOn && endsOn && endsOn < startsOn ? "" : endsOn,
  };
}

/** Always returns the three known templates, ignoring anything else. */
export function normalizeOffers(input: Partial<ShopOffer>[] | undefined): ShopOffer[] {
  return KINDS.map((kind) => {
    const base = defaultOffers().find((offer) => offer.kind === kind)!;
    const found = input?.find((offer) => offer.id === kind || offer.kind === kind);
    return clampOffer(kind, found, base);
  });
}

function inWindow(offer: ShopOffer, today: string): boolean {
  if (offer.startsOn && today < offer.startsOn) return false;
  if (offer.endsOn && today > offer.endsOn) return false;
  return true;
}

function kindMatches(offer: ShopOffer, customer: CustomerProfile, today: string): boolean {
  if (offer.kind === "new_customer") return customer.orderCount <= 0;
  if (offer.kind === "loyal") return accountAgeDays(customer.createdAt, today) >= (offer.minAccountDays || 7);
  return true;
}

export function discountKronor(offer: ShopOffer, subtotal: number): number {
  if (subtotal <= 0 || offer.amount <= 0) return 0;
  const raw = offer.unit === "percent" ? Math.round((subtotal * offer.amount) / 100) : offer.amount;
  return Math.max(0, Math.min(subtotal, raw));
}

/** Offers the account qualifies for, ignoring the cart total. */
export function eligibleOffers(offers: ShopOffer[], customer: CustomerProfile | null, today: string): ShopOffer[] {
  if (!customer) return [];
  return normalizeOffers(offers).filter((offer) => offer.enabled && inWindow(offer, today) && kindMatches(offer, customer, today));
}

/** Largest single discount. Offers do not stack. */
export function pickOffer(offers: ShopOffer[], customer: CustomerProfile | null, subtotal: number, today: string): AppliedOffer | null {
  const ranked = eligibleOffers(offers, customer, today)
    .filter((offer) => subtotal >= offer.minOrder)
    .map((offer) => ({ offer, discount: discountKronor(offer, subtotal) }))
    .filter((item) => item.discount > 0)
    .sort((a, b) => b.discount - a.discount || KINDS.indexOf(a.offer.kind) - KINDS.indexOf(b.offer.kind));
  const best = ranked[0];
  if (!best) return null;
  return {
    offerId: best.offer.kind,
    title: best.offer.title,
    unit: best.offer.unit,
    amount: best.offer.amount,
    discount: best.discount,
  };
}

export function offerSummary(offer: ShopOffer): string {
  const value = offer.unit === "percent" ? `${offer.amount}%` : `${offer.amount} kr`;
  const min = offer.minOrder > 0 ? ` från ${offer.minOrder} kr` : "";
  return `${offer.title}: ${value} rabatt${min}`;
}
