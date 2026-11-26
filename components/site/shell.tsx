"use client";

import { ChevronRight, Gem, Gift, Heart, Leaf, Menu, MessageCircle, Search, Shield, ShoppingBag, Star, Truck, User, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { AfricaMark } from "@/components/AfricaMark";
import type { IconName, Product, SiteContent } from "@/lib/types";
import { StoreCard, useNow } from "./store-bits";

type Cart = Record<string, number>;

interface ShopValue {
  products: Product[];
  content: SiteContent;
  cart: Cart;
  favorites: string[];
  add: (id: string, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  toggleFavorite: (id: string) => void;
  clearCart: () => void;
  refresh: () => Promise<void>;
  count: number;
}

const ShopContext = createContext<ShopValue | null>(null);

export function useShop() {
  const value = useContext(ShopContext);
  if (!value) throw new Error("useShop utanför butiken");
  return value;
}

const ICONS: Record<IconName, typeof Truck> = {
  truck: Truck,
  shield: Shield,
  chat: MessageCircle,
  leaf: Leaf,
  diamond: Gem,
  gift: Gift,
  star: Star,
  people: Users,
};

export function IconTextRow({ items, className = "" }: { items: SiteContent["features"]; className?: string }) {
  return (
    <ul className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? Leaf;
        return (
          <li key={item.id} className="flex items-center justify-center gap-2 text-center text-sm text-brown">
            <Icon className="h-4 w-4 shrink-0 text-gold-deep" />
            <span>{item.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function InfoBar({ items }: { items: SiteContent["infoBar"] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const media = window.matchMedia("(min-width: 768px)");
    if (media.matches) return;
    const id = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 3600);
    return () => window.clearInterval(id);
  }, [items.length]);
  return (
    <div className="h-9 overflow-hidden border-b border-white/10 bg-bark text-[13px] text-[#f6efe4]">
      <div className="mx-auto hidden h-full max-w-6xl items-center justify-center gap-10 md:flex">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? Truck;
          return (
            <span key={item.id} className="inline-flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-[#f6efe4]" /> {item.text}
            </span>
          );
        })}
      </div>
      <div className="relative h-full md:hidden">
        {items.map((item, itemIndex) => {
          const Icon = ICONS[item.icon] ?? Truck;
          return (
            <p key={item.id} className={`absolute inset-0 flex items-center justify-center gap-2 px-4 transition-opacity duration-300 ${itemIndex === index ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              <Icon className="h-3.5 w-3.5 shrink-0 text-[#f6efe4]" />
              <span className="truncate">{item.text}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
}

function Header({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { content, count } = useShop();
  return (
    <header className="bg-bark text-[#f6efe4]">
      <InfoBar items={content.infoBar} />
      <div className="wrap grid h-[4.6rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 md:h-[4.75rem]">
        <div className="flex items-center">
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-[#f6efe4] hover:bg-white/10 md:h-11 md:w-11" aria-label="Meny" onClick={onMenu}>
            <Menu className="h-5 w-5" />
          </button>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-[#f6efe4] hover:bg-white/10 md:h-11 md:w-11" aria-label="Sök" onClick={onSearch}>
            <Search className="h-5 w-5" />
          </button>
        </div>
        <Link href="/" className="min-w-0 justify-self-center text-center">
          <span className="flex items-center justify-center gap-1.5">
            <span className="truncate font-display text-[1.35rem] leading-none tracking-tight text-[#f7f1e6] sm:text-[1.55rem] md:text-[1.85rem]">
              Afro<span className="italic text-gold">Corner</span>
            </span>
            <AfricaMark className="h-6 w-5 shrink-0 text-gold md:h-7 md:w-6" />
          </span>
          <span className="mt-1 block truncate text-[8px] font-medium uppercase tracking-[0.12em] text-gold sm:text-[10px] sm:tracking-[0.18em]">
            Afrikanska varor • Hårvård • Mat • Skönhet
          </span>
        </Link>
        <div className="flex items-center pr-1 text-[#f6efe4]">
          <Link href="/konto" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 md:h-11 md:w-11" aria-label="Konto">
            <User className="h-5 w-5" />
          </Link>
          <Link href="/favoriter" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 md:h-11 md:w-11" aria-label="Favoriter">
            <Heart className="h-5 w-5" />
          </Link>
          <Link href="/varukorg" className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 md:h-11 md:w-11" aria-label={`Varukorg, ${count} varor`}>
            <ShoppingBag className="h-5 w-5" />
            <span className="absolute right-0 top-0 z-10 grid h-[1.15rem] min-w-[1.15rem] -translate-y-0.5 translate-x-0 place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold leading-none text-bark">{count}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { content } = useShop();
  const router = useRouter();
  const now = useNow();
  const [query, setQuery] = useState("");
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-bark/40" aria-label="Stäng meny" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-[min(100%,22rem)] flex-col bg-paper shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="font-display text-2xl">Meny</p>
          <button type="button" className="grid h-11 w-11 place-items-center rounded-full hover:bg-cream" aria-label="Stäng" onClick={onClose}>
            <X />
          </button>
        </div>
        <form className="px-4" onSubmit={(event) => { event.preventDefault(); onClose(); router.push(`/sok?q=${encodeURIComponent(query)}`); }}>
          <input className="field" placeholder="Sök varor" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Sök" />
        </form>
        <nav className="mt-3 flex-1 overflow-y-auto px-2">
          {content.categories.map((category) => (
            <Link key={category.id} href={category.href} onClick={onClose} className="flex items-center justify-between rounded-2xl px-3 py-3 text-base hover:bg-cream">
              {category.name} <ChevronRight className="h-4 w-4 text-muted" />
            </Link>
          ))}
          <Link href="/erbjudanden" onClick={onClose} className="flex items-center justify-between rounded-2xl px-3 py-3 hover:bg-cream">Aktuella erbjudanden <ChevronRight className="h-4 w-4 text-muted" /></Link>
          <Link href="/hitta-oss" onClick={onClose} className="flex items-center justify-between rounded-2xl px-3 py-3 hover:bg-cream">Hitta oss <ChevronRight className="h-4 w-4 text-muted" /></Link>
          <Link href="/varukorg" onClick={onClose} className="flex items-center justify-between rounded-2xl px-3 py-3 hover:bg-cream">Varukorg <ChevronRight className="h-4 w-4 text-muted" /></Link>
        </nav>
        <div className="max-h-[46%] space-y-3 overflow-y-auto border-t border-line px-4 py-4">
          {content.stores.map((store) => (
            <StoreCard key={store.id} store={store} now={now} dense />
          ))}
        </div>
      </div>
    </div>
  );
}

function Footer() {
  const { content } = useShop();
  const now = useNow();
  return (
    <footer className="mt-16 border-t border-line bg-paper">
      <div className="wrap py-8">
        <IconTextRow items={content.footerHighlights} />
      </div>
      <div className="border-t border-line">
        <div className="wrap py-10">
          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            {content.stores.map((store) => (
              <StoreCard key={store.id} store={store} now={now} />
            ))}
          </div>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            <div>
              <p className="font-display text-3xl">Afro<span className="italic text-gold">Corner</span></p>
              <p className="mt-3 text-sm leading-6 text-muted">{content.footerAbout}</p>
              <p className="mt-3 text-sm">Fri frakt över {content.freeShippingThreshold} kr vid hemleverans.</p>
            </div>
            <div>
              <p className="font-medium">Handla</p>
              <ul className="mt-3 space-y-2 text-sm">
                {content.categories.map((category) => (
                  <li key={category.id}><Link href={category.href} className="hover:underline">{category.name}</Link></li>
                ))}
                <li><Link href="/erbjudanden" className="hover:underline">Erbjudanden</Link></li>
              </ul>
            </div>
            <div className="text-sm">
              <p className="font-medium">Kundtjänst</p>
              <p className="mt-3"><a className="hover:underline" href={`tel:${content.ownerPhone}`}>{content.ownerPhone}</a></p>
              <p className="mt-1"><a className="hover:underline" href={`mailto:${content.footerEmail}`}>{content.footerEmail}</a></p>
              <p className="mt-4"><Link href="/hitta-oss" className="hover:underline">Hitta oss</Link></p>
            </div>
          </div>
        </div>
        <p className="wrap pb-8 text-xs text-muted">© {new Date().getFullYear()} AfroCorner</p>
      </div>
    </footer>
  );
}

export function ShopShell({
  initialProducts,
  initialContent,
  children,
}: {
  initialProducts: Product[];
  initialContent: SiteContent;
  children: React.ReactNode;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [content, setContent] = useState(initialContent);
  const [cart, setCart] = useState<Cart>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setProducts(initialProducts);
    setContent(initialContent);
  }, [initialProducts, initialContent]);

  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem("afrocorner-cart") || "{}"));
      setFavorites(JSON.parse(localStorage.getItem("afrocorner-favorites") || "[]"));
    } catch {
      /* ignore broken local storage */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("afrocorner-cart", JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    localStorage.setItem("afrocorner-favorites", JSON.stringify(favorites));
  }, [favorites]);
  useEffect(() => { setMenu(false); setSearchOpen(false); }, [pathname]);

  useLayoutEffect(() => {
    const header = document.querySelector("[data-site-header]");
    if (!header) return;
    const apply = () => document.documentElement.style.setProperty("--header-h", `${header.getBoundingClientRect().height}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    return () => observer.disconnect();
  }, [content.infoBar.length]);

  const count = useMemo(() => Object.values(cart).reduce((sum, qty) => sum + qty, 0), [cart]);

  const value: ShopValue = {
    products,
    content,
    cart,
    favorites,
    count,
    add(id, qty = 1) {
      setCart((current) => ({ ...current, [id]: Math.min(99, (current[id] ?? 0) + qty) }));
    },
    setQty(id, qty) {
      setCart((current) => {
        const next = { ...current };
        if (qty <= 0) delete next[id];
        else next[id] = Math.min(99, qty);
        return next;
      });
    },
    toggleFavorite(id) {
      setFavorites((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    },
    clearCart() { setCart({}); },
    async refresh() {
      const response = await fetch("/api/catalog");
      const data = await response.json();
      setProducts((data.products as Product[]).filter((product) => product.active));
      setContent(data.content);
    },
  };

  return (
    <ShopContext.Provider value={value}>
      <div data-site-header className="fixed inset-x-0 top-0 z-50 bg-bark">
        <Header onMenu={() => setMenu(true)} onSearch={() => setSearchOpen(true)} />
      </div>
      <div aria-hidden style={{ height: "var(--header-h)" }} />
      <NavDrawer open={menu} onClose={() => setMenu(false)} />
      {searchOpen && (
        <div className="fixed inset-x-0 z-40 bg-paper shadow-md" style={{ top: "var(--header-h)" }}>
          <form className="wrap flex gap-2 py-3" onSubmit={(event) => { event.preventDefault(); setSearchOpen(false); router.push(`/sok?q=${encodeURIComponent(query)}`); }}>
            <input className="field" autoFocus placeholder="Sök hårvård, kryddor, korgar…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Sök i butiken" />
            <button type="submit" className="gold-btn rounded-full px-4">Sök</button>
          </form>
        </div>
      )}
      <main>{children}</main>
      <Footer />
    </ShopContext.Provider>
  );
}
