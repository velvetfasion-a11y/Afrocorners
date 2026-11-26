import { absoluteImage, sek, toE164 } from "./format";
import type { Order, StoreId } from "./types";

export interface OrderMessageInput {
  template: string;
  order: Order;
  origin: string;
  stores: { id: StoreId; name: string }[];
  freeShippingThreshold: number;
}

function storeName(stores: { id: StoreId; name: string }[], id: StoreId | null): string {
  if (!id) return "";
  return stores.find((store) => store.id === id)?.name ?? id;
}

export function fulfilmentBlock(input: OrderMessageInput): string {
  const { order, stores, freeShippingThreshold } = input;
  if (order.fulfilment === "pickup") {
    const name = storeName(stores, order.pickupStoreId);
    return [`Leveranssätt: Avhämtning i butik${name ? ` (${name})` : ""}`, "Frakt: Ingen, hämtas i butik"].join("\n");
  }
  const shipping =
    order.total >= freeShippingThreshold
      ? `Frakt: Fri frakt (över ${freeShippingThreshold} kr)`
      : `Frakt: Frakt tillkommer (under ${freeShippingThreshold} kr)`;
  return ["Leveranssätt: Hemleverans", shipping].join("\n");
}

export function customerBlock(order: Order): string {
  const lines = [`Namn: ${order.customer.name}`, `Telefon: ${order.customer.phone}`];
  if (order.fulfilment === "delivery") {
    if (order.customer.address) lines.push(`Adress: ${order.customer.address}`);
    if (order.customer.postalCode || order.customer.city) {
      lines.push(`Postadress: ${order.customer.postalCode} ${order.customer.city}`.trim());
    }
  }
  return lines.join("\n");
}

export function itemsBlock(order: Order, origin: string): string {
  return order.items
    .map((item) => {
      const lineTotal = item.unitPrice * item.qty;
      const image = absoluteImage(origin, item.image);
      const lines = [`• ${item.name}`, `  ${item.qty} st × ${sek(item.unitPrice)} = ${sek(lineTotal)}`];
      if (image) lines.push(`  Bild: ${image}`);
      return lines.join("\n");
    })
    .join("\n");
}

export function buildOrderMessage(input: OrderMessageInput): string {
  const items = itemsBlock(input.order, input.origin);
  const total = sek(input.order.total);
  const fulfilment = fulfilmentBlock(input);
  const customer = customerBlock(input.order);
  const number = input.order.number;
  let text = input.template
    .replaceAll("{{items}}", items)
    .replaceAll("{{total}}", total)
    .replaceAll("{{fulfilment}}", fulfilment)
    .replaceAll("{{customer}}", customer)
    .replaceAll("{{number}}", number);
  if (!input.template.includes("{{items}}")) text += `\n\n${items}`;
  if (!input.template.includes("{{total}}")) text += `\n\nTotalt: ${total}`;
  if (!input.template.includes("{{fulfilment}}")) text += `\n${fulfilment}`;
  if (!input.template.includes("{{customer}}")) text += `\n${customer}`;
  if (!input.template.includes("{{number}}")) text += `\nOrdernummer: ${number}`;
  return text.trim();
}

/** Drop image lines when the SMS/WhatsApp URL would be too long. */
export function fitMessage(text: string, max = 1500): string {
  if (text.length <= max) return text;
  const withoutImages = text
    .split("\n")
    .filter((line) => !line.trim().startsWith("Bild:"))
    .join("\n")
    .trim();
  const note = "\n(Bildlänkarna fick inte plats i meddelandet.)";
  if (withoutImages.length + note.length <= max) return withoutImages + note;
  return `${withoutImages.slice(0, Math.max(0, max - note.length - 1)).trim()}${note}`;
}

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${toE164(phone)}?text=${encodeURIComponent(fitMessage(text))}`;
}

export function smsUrl(phone: string, text: string): string {
  return `sms:+${toE164(phone)}?&body=${encodeURIComponent(fitMessage(text))}`;
}

export function customerReply(order: Order): string {
  return `Hej ${order.customer.name}! Det gäller din order ${order.number} hos AfroCorner.`;
}
