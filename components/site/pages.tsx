"use client";

import { Heart, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { badgeFor, normalizeName, sek, toE164 } from "@/lib/format";
import { offerSummary } from "@/lib/offers";
import { cartKey, defaultVariant, findVariant, hasVariants, parseCartKey, storeQty, variantImage, variantPrice, variantTitle } from "@/lib/variants";
import { buildOrderMessage, smsUrl, whatsappUrl } from "@/lib/orders";
import type { Order, Product, StoreId } from "@/lib/types";
import { ProductGrid } from "./product-card";
import { StoreCard, StoreLines, useNow } from "./store-bits";
import { useShop } from "./shell";

export function CategoryPage({ slug }: { slug: string }) {
  const { products, content } = useShop();
  const tile = content.categories.find((item) => item.id === slug);
  const list = products.filter((product) => product.category === slug).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="wrap py-8">
      <h1 className="font-display text-4xl">{tile?.name ?? "Kategori"}</h1>
      <div className="mt-6"><ProductGrid products={list} /></div>
    </div>
  );
}

export function OffersPage() {
  const { products } = useShop();
  const list = products.filter((product) => product.offer).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="wrap py-8">
      <h1 className="font-display text-4xl">Aktuella erbjudanden</h1>
      <div className="mt-6"><ProductGrid products={list} /></div>
    </div>
  );
}

export function NewsPage() {
  const { products } = useShop();
  const list = products.filter((product) => product.news).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="wrap py-8">
      <h1 className="font-display text-4xl">Nyheter</h1>
      <div className="mt-6"><ProductGrid products={list} /></div>
    </div>
  );
}

export function SearchPage() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const { products, content } = useShop();
  const needle = normalizeName(q);
  const list = products.filter((product) => {
    const category = content.categories.find((item) => item.id === product.category)?.name ?? "";
    const haystack = normalizeName(`${product.name} ${product.description} ${product.sku} ${category}`);
    return needle.length === 0 || haystack.includes(needle);
  });
  return (
    <div className="wrap py-8">
      <h1 className="font-display text-4xl">Sök</h1>
      <p className="mt-2 text-muted">{q ? `Resultat för “${q}”` : "Skriv ett ord i sökfältet."}</p>
      <div className="mt-6"><ProductGrid products={q ? list : []} /></div>
    </div>
  );
}

export function FavoritesPage() {
  const { products, favorites } = useShop();
  const list = products.filter((product) => favorites.includes(product.id));
  return (
    <div className="wrap py-8">
      <h1 className="font-display text-4xl">Favoriter</h1>
      <div className="mt-6"><ProductGrid products={list} /></div>
    </div>
  );
}

function availability(name: string, qty: number) {
  return qty > 0 ? `I lager ${name}` : "Slut i lager";
}

export function ProductPage({ slug }: { slug: string }) {
  const { products, content, add, cart, toggleFavorite, favorites } = useShop();
  const product = products.find((item) => item.slug === slug);
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState("");
  if (!product) return <div className="wrap py-16"><p>Varan finns inte.</p><Link href="/" className="underline">Till startsidan</Link></div>;
  const variants = product.variants ?? [];
  const selectedId = variants.some((variant) => variant.id === variantId) ? variantId : (defaultVariant(product)?.id ?? "");
  const variant = findVariant(product, selectedId);
  const price = variantPrice(product, variant);
  const loved = favorites.includes(product.id);
  const inCart = cart[cartKey(product.id, variant?.id)] ?? 0;
  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4);
  return (
    <div className="wrap py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <img src={variantImage(product, variant)} alt={variantTitle(product, variant)} className="w-full rounded-[1.6rem] object-cover" />
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-muted">{content.categories.find((item) => item.id === product.category)?.name}</p>
          <h1 className="mt-2 font-display text-4xl">{product.name}</h1>
          {variants.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Storlek">
              {variants.map((item) => {
                const on = item.id === selectedId;
                return (
                  <button key={item.id} type="button" role="radio" aria-checked={on} className={`h-11 rounded-full px-4 text-sm ${on ? "bg-bark text-cream" : "border border-[#e4d3b4] bg-white text-ink"}`} onClick={() => setVariantId(item.id)}>
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-4 text-lg">
            {!variant && product.salePrice != null && product.salePrice < product.price && <span className="mr-2 text-muted line-through">{sek(product.price)}</span>}
            <span className="font-medium">{sek(price)}</span>
            {badgeFor(product) && <span className="ml-2 rounded-full bg-bark px-2 py-1 text-xs text-cream">{badgeFor(product)}</span>}
          </p>
          <p className="mt-4 leading-7 text-brown">{product.description}</p>
          <ul className="mt-4 space-y-1 text-sm">
            <li className={storeQty(product, "fittja", variant) > 0 ? "text-good" : "text-gold-deep"}>{availability("Fittja", storeQty(product, "fittja", variant))}{storeQty(product, "fittja", variant) <= 0 ? " · Fittja" : ""}</li>
            <li className={storeQty(product, "marsta", variant) > 0 ? "text-good" : "text-gold-deep"}>{availability("Märsta", storeQty(product, "marsta", variant))}{storeQty(product, "marsta", variant) <= 0 ? " · Märsta" : ""}</li>
          </ul>
          {storeQty(product, "fittja", variant) + storeQty(product, "marsta", variant) === 0 && <p className="mt-2 text-sm text-muted">Vi bekräftar lager när vi svarar.</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border border-line bg-paper">
              <button type="button" className="grid h-12 w-12 place-items-center" aria-label="Minska antal" onClick={() => setQty((value) => Math.max(1, value - 1))}><Minus /></button>
              <span className="w-8 text-center">{qty}</span>
              <button type="button" className="grid h-12 w-12 place-items-center" aria-label="Öka antal" onClick={() => setQty((value) => Math.min(99, value + 1))}><Plus /></button>
            </div>
            <button type="button" className="gold-btn h-12 rounded-full px-6" onClick={() => add(product.id, qty, variant?.id)}>
              Lägg i varukorg{inCart ? ` (${inCart} i korgen)` : ""}
            </button>
            <button type="button" className="grid h-12 w-12 place-items-center rounded-full border border-line" aria-label="Favorit" onClick={() => toggleFavorite(product.id)}>
              <Heart className={loved ? "fill-gold text-gold" : ""} />
            </button>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="font-display text-3xl">Mer i samma hylla</h2>
          <div className="mt-4"><ProductGrid products={related} /></div>
        </div>
      )}
    </div>
  );
}

function cartLines(products: Product[], cart: Record<string, number>) {
  return Object.entries(cart).flatMap(([key, qty]) => {
    const parsed = parseCartKey(key);
    const product = products.find((item) => item.id === parsed.productId);
    if (!product || qty <= 0) return [];
    const variant = findVariant(product, parsed.variantId);
    if (hasVariants(product) && !variant) return [];
    return [{ key, product, variant, qty, price: variantPrice(product, variant) }];
  });
}

export function CartPage() {
  const { products, cart, setQty, content, quote, account } = useShop();
  const lines = cartLines(products, cart);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const deal = quote(subtotal);
  const total = subtotal - (deal?.discount ?? 0);
  const left = content.freeShippingThreshold - subtotal;
  return (
    <div className="wrap py-8">
      <h1 className="font-display text-4xl">Varukorg</h1>
      {lines.length === 0 ? (
        <p className="mt-6 text-muted">Korgen är tom. <Link href="/#kategorier" className="underline">Utforska butiken</Link></p>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_18rem]">
          <ul className="space-y-4">
            {lines.map((line) => (
                <li key={line.key} className="flex gap-3 rounded-3xl bg-paper p-3">
                  <img src={variantImage(line.product, line.variant)} alt="" className="h-24 w-24 rounded-2xl object-cover" />
                  <div className="flex-1">
                    <Link href={`/produkt/${line.product.slug}`} className="font-medium">{variantTitle(line.product, line.variant)}</Link>
                    <p className="text-sm text-muted">{sek(line.price)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-line" aria-label="Minska" onClick={() => setQty(line.product.id, line.qty - 1, line.variant?.id)}><Minus className="h-4 w-4" /></button>
                      <span>{line.qty}</span>
                      <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-line" aria-label="Öka" onClick={() => setQty(line.product.id, line.qty + 1, line.variant?.id)}><Plus className="h-4 w-4" /></button>
                      <button type="button" className="ml-auto text-sm text-muted underline" onClick={() => setQty(line.product.id, 0, line.variant?.id)}>Ta bort</button>
                    </div>
                  </div>
                </li>
            ))}
          </ul>
          <aside className="h-fit rounded-3xl bg-paper p-5">
            <p className="text-sm text-muted">Att betala hos butiken</p>
            {deal && (
              <p className="mt-2 text-sm text-brown">{deal.title}: −{sek(deal.discount)}</p>
            )}
            {!account && <p className="mt-2 text-sm text-muted"><Link href="/konto" className="underline">Logga in</Link> för att se dina rabatter.</p>}
            <p className="font-display text-4xl">{sek(total)}</p>
            <p className="mt-2 text-sm">{left > 0 ? `${sek(left)} kvar till fri frakt.` : `Fri frakt över ${content.freeShippingThreshold} kr.`}</p>
            <Link href="/kassa" className="gold-btn mt-5 flex h-12 items-center justify-center rounded-full">Till beställning</Link>
          </aside>
        </div>
      )}
    </div>
  );
}

export function CheckoutPage() {
  const { products, cart, content, clearCart, quote, account, refreshAccount } = useShop();
  const router = useRouter();
  const lines = cartLines(products, cart);
  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">("delivery");
  const [storeId, setStoreId] = useState<StoreId>("fittja");
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", postalCode: "", city: "" });
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const deal = quote(subtotal);
  const total = subtotal - (deal?.discount ?? 0);
  useEffect(() => {
    if (!account?.customer.name) return;
    setCustomer((current) => current.name ? current : { ...current, name: account.customer.name });
  }, [account]);

  const message = useMemo(() => {
    if (!order) return "";
    return buildOrderMessage({
      template: content.messageTemplate,
      order,
      origin: typeof window === "undefined" ? "" : window.location.origin,
      stores: content.stores,
      freeShippingThreshold: content.freeShippingThreshold,
    });
  }, [order, content]);

  async function ensureOrder() {
    if (order) return order;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (account) headers.Authorization = `Bearer ${await account.getIdToken()}`;
    const response = await fetch("/api/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({
        items: lines.map((line) => ({ productId: line.product.id, variantId: line.variant?.id, qty: line.qty })),
        fulfilment,
        pickupStoreId: storeId,
        customer,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Kunde inte spara ordern.");
    const saved = data.order as Order;
    const mine = JSON.parse(localStorage.getItem("afrocorner-my-orders") || "[]") as Order[];
    localStorage.setItem("afrocorner-my-orders", JSON.stringify([saved, ...mine].slice(0, 20)));
    setOrder(saved);
    clearCart();
    await refreshAccount();
    return saved;
  }

  async function send(channel: "whatsapp" | "sms") {
    setError("");
    setNote("");
    if (lines.length === 0 && !order) {
      setError("Varukorgen är tom.");
      return;
    }
    setBusy(true);
    try {
      const saved = await ensureOrder();
      const text = buildOrderMessage({
        template: content.messageTemplate,
        order: saved,
        origin: window.location.origin,
        stores: content.stores,
        freeShippingThreshold: content.freeShippingThreshold,
      });
      const phone = toE164(content.ownerPhone);
      if (channel === "whatsapp") {
        const files = await imageFiles(saved);
        if (files.length && navigator.canShare?.({ files })) {
          try {
            await navigator.share({ files, text, title: `AfroCorner ${saved.number}` });
            setNote("Delningen öppnades med bilderna. Skicka meddelandet till butiken.");
            return;
          } catch (shareError) {
            if (shareError instanceof DOMException && shareError.name === "AbortError") {
              setNote("Delningen avbröts. Tryck på WhatsApp igen för att öppna ett meddelande med bildlänkar.");
              return;
            }
          }
        }
        window.open(whatsappUrl(phone, text), "_blank", "noopener,noreferrer");
      } else {
        window.location.href = smsUrl(phone, text);
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Något gick fel.");
    } finally {
      setBusy(false);
    }
  }

  if (lines.length === 0 && !order) {
    return <div className="wrap py-16">Korgen är tom. <button className="underline" onClick={() => router.push("/")}>Till butiken</button></div>;
  }

  return (
    <div className="wrap py-8">
      <h1 className="font-display text-4xl">Skicka beställning</h1>
      <p className="mt-2 max-w-xl text-muted">Du betalar inte här. Vi skickar en betalningslänk när vi har sett ordern.</p>
      {order ? (
        <div className="mt-6 rounded-3xl bg-paper p-5">
          <p className="font-medium">Order {order.number} är sparad.</p>
          <p className="mt-2 text-sm text-muted">Skicka meddelandet till butiken om det inte redan öppnats.</p>
          <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-cream p-3 text-sm">{message}</pre>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" className={`rounded-3xl border p-4 text-left ${fulfilment === "delivery" ? "border-gold bg-paper" : "border-line"}`} onClick={() => setFulfilment("delivery")}>
                <span className="font-medium">Hemleverans</span>
                <span className="mt-1 block text-sm text-muted">Vi skickar paketet. Fri frakt över {content.freeShippingThreshold} kr.</span>
              </button>
              <button type="button" className={`rounded-3xl border p-4 text-left ${fulfilment === "pickup" ? "border-gold bg-paper" : "border-line"}`} onClick={() => setFulfilment("pickup")}>
                <span className="font-medium">Hämta i butik</span>
                <span className="mt-1 block text-sm text-muted">Fittja eller Märsta.</span>
              </button>
            </div>
            <label className="block text-sm">Namn<input className="field mt-1" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label>
            <label className="block text-sm">Telefon<input className="field mt-1" inputMode="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label>
            {fulfilment === "delivery" ? (
              <>
                <label className="block text-sm">Adress<input className="field mt-1" value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">Postnummer<input className="field mt-1" value={customer.postalCode} onChange={(event) => setCustomer({ ...customer, postalCode: event.target.value })} /></label>
                  <label className="block text-sm">Ort<input className="field mt-1" value={customer.city} onChange={(event) => setCustomer({ ...customer, city: event.target.value })} /></label>
                </div>
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {content.stores.map((store) => (
                  <button type="button" key={store.id} className={`rounded-3xl border p-4 text-left ${storeId === store.id ? "border-gold bg-paper" : "border-line"}`} onClick={() => setStoreId(store.id)}>
                    <StoreLines store={store} compact />
                  </button>
                ))}
              </div>
            )}
            {deal && <p className="text-sm text-brown">{deal.title}: −{sek(deal.discount)}</p>}
            <p className="text-sm text-muted">Totalt {sek(total)}. Betalning sker via länken butiken skickar.</p>
          </div>
          <ul className="space-y-2 text-sm">
            {lines.map((line) => (
              <li key={line.product.id} className="flex justify-between gap-3">
                <span>{line.qty} × {variantTitle(line.product, line.variant)}</span>
                <span>{sek(line.price * line.qty)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="mt-4 text-sm text-red-800">{error}</p>}
      {note && <p className="mt-4 text-sm text-brown">{note}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div>
          <button type="button" disabled={busy} className="h-14 w-full rounded-full bg-[#128C7E] font-medium text-white disabled:opacity-60" onClick={() => send("whatsapp")}>WhatsApp</button>
          <p className="mt-2 text-sm text-muted">Öppnar ett meddelande till butiken. På mobilen kan produktbilderna följa med.</p>
        </div>
        <div>
          <button type="button" disabled={busy} className="h-14 w-full rounded-full border border-brown bg-paper font-medium disabled:opacity-60" onClick={() => send("sms")}>SMS</button>
          <p className="mt-2 text-sm text-muted">Öppnar ett SMS till butiken med ordern och bildlänkar.</p>
        </div>
      </div>
    </div>
  );
}

async function imageFiles(order: Order): Promise<File[]> {
  const files: File[] = [];
  for (const [index, item] of order.items.entries()) {
    const url = item.image.startsWith("http") ? item.image : item.image.startsWith("/") ? item.image : "";
    if (!url) continue;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const blob = await response.blob();
      files.push(new File([blob], `vara-${index + 1}.jpg`, { type: blob.type || "image/jpeg" }));
    } catch {
      /* links remain in the text */
    }
  }
  return files;
}

export function StoresPage() {
  const { content } = useShop();
  const now = useNow();
  return (
    <div className="wrap py-8">
      <h1 className="font-display text-4xl">Hitta oss</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {content.stores.map((store) => (
          <StoreCard key={store.id} store={store} now={now} />
        ))}
      </div>
    </div>
  );
}

export function AccountPage() {
  const { content, products, favorites, account, accountReady, googleConfigured, signInAccount, signOutAccount } = useShop();
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      setLocalOrders(JSON.parse(localStorage.getItem("afrocorner-my-orders") || "[]") as Order[]);
    } catch {
      setLocalOrders([]);
    }
  }, [account?.customer.uid]);
  const saved = account
    ? [...account.orders, ...localOrders.filter((order) => !account.orders.some((item) => item.id === order.id))]
    : localOrders;
  const loved = products.filter((product) => favorites.includes(product.id));

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      await signInAccount();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunde inte logga in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap py-8">
      <h1 className="font-display text-4xl">Konto</h1>
      {!accountReady && <p className="mt-2 text-muted">Hämtar kontot…</p>}
      {accountReady && !account && (
        <div className="mt-6 max-w-md rounded-3xl bg-paper p-5">
          <p className="text-muted">Logga in med Google för att spara favoriter och se rabatter. Det här är inte butikens admin.</p>
          {googleConfigured ? (
            <button type="button" disabled={busy} className="gold-btn mt-4 h-12 w-full rounded-full disabled:opacity-60" onClick={signIn}>Logga in med Google</button>
          ) : (
            <p className="mt-4 text-sm text-muted">Google-inloggning är inte påslagen i den här förhandsvisningen.</p>
          )}
          {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
        </div>
      )}
      {account && (
        <div className="mt-6 max-w-md rounded-3xl bg-paper p-5">
          <p className="font-display text-3xl">{account.customer.name}</p>
          <p className="text-sm text-muted">{account.customer.email}</p>
          <button type="button" className="mt-4 text-sm underline" onClick={() => signOutAccount()}>Logga ut</button>
        </div>
      )}
      {account && (
        <section className="mt-8">
          <h2 className="font-display text-2xl">Dina erbjudanden</h2>
          {account.offers.length === 0 && <p className="mt-2 text-muted">Inga aktiva rabatter just nu.</p>}
          <ul className="mt-3 space-y-2">
            {account.offers.map((offer) => (
              <li key={offer.id} className="rounded-2xl border border-[#e4d3b4] bg-[#fbf6ee] px-4 py-3 text-sm">{offerSummary(offer)}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-8">
        <h2 className="font-display text-2xl">Favoriter</h2>
        {loved.length === 0 && <p className="mt-2 text-muted">Inga sparade favoriter ännu.</p>}
        <ul className="mt-3 space-y-2">
          {loved.map((product) => (
            <li key={product.id}><Link href={`/produkt/${product.slug}`} className="underline">{product.name}</Link></li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="font-display text-2xl">Beställningar</h2>
        <ul className="mt-3 space-y-3">
          {saved.length === 0 && <li className="text-muted">Inga sparade beställningar ännu.</li>}
          {saved.map((order) => (
            <li key={order.id} className="rounded-3xl bg-paper p-4">
              <p className="font-medium">{order.number}</p>
              <p className="text-sm text-muted">{sek(order.total)} · {order.fulfilment === "pickup" ? "Hämta i butik" : "Hemleverans"}{order.discount ? ` · ${order.discount.title}` : ""}</p>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-8 text-sm">Kundtjänst {content.ownerPhone}</p>
    </div>
  );
}
