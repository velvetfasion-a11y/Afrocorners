import type { Product } from "./types";

export function sek(value: number): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function unitPrice(product: Pick<Product, "price" | "salePrice">): number {
  if (product.salePrice != null && product.salePrice >= 0 && product.salePrice < product.price) {
    return product.salePrice;
  }
  return product.price;
}

export function badgeFor(product: Pick<Product, "price" | "salePrice" | "badge">): string {
  const custom = product.badge.trim();
  if (custom) return custom;
  if (product.salePrice != null && product.salePrice < product.price && product.price > 0) {
    const pct = Math.round((1 - product.salePrice / product.price) * 100);
    if (pct > 0) return `-${pct}%`;
  }
  return "";
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

/** Swedish mobiles and +46 numbers to digits without a plus, for wa.me. */
export function toE164(input: string): string {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `46${digits.slice(1)}`;
  return digits;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function makeOrderNumber(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Stockholm",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const stamp = `${get("year")}${get("month")}${get("day")}`;
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `AC-${stamp}-${suffix}`;
}

export function absoluteImage(origin: string, image: string): string {
  if (!image) return "";
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (image.startsWith("data:")) return "";
  const base = origin.replace(/\/$/, "");
  return `${base}${image.startsWith("/") ? image : `/${image}`}`;
}

export function isStoreId(value: string): value is "fittja" | "marsta" {
  return value === "fittja" || value === "marsta";
}
