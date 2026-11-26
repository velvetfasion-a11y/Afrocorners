"use client";

import { Home, Menu, Package, ShoppingBag, Warehouse } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { AfricaMark } from "@/components/AfricaMark";

const DirtyContext = createContext<{ dirty: boolean; setDirty: (value: boolean) => void } | null>(null);

export function useAdminDirty() {
  const value = useContext(DirtyContext);
  if (!value) throw new Error("Saknar admin");
  return value;
}

const TABS = [
  { href: "/admin", label: "Hem", icon: Home, match: (path: string) => path === "/admin" },
  { href: "/admin/ordrar", label: "Beställningar", icon: ShoppingBag, match: (path: string) => path.startsWith("/admin/ordrar") },
  { href: "/admin/produkter", label: "Produkter", icon: Package, match: (path: string) => path.startsWith("/admin/produkter") },
  { href: "/admin/lager", label: "Lager", icon: Warehouse, match: (path: string) => ["/admin/lager", "/admin/salt", "/admin/logg"].some((item) => path.startsWith(item)) },
  { href: "/admin/mer", label: "Mer", icon: Menu, match: (path: string) => ["/admin/mer", "/admin/innehall", "/admin/butiker", "/admin/installningar"].some((item) => path.startsWith(item)) },
];

const SIDE = [
  ["/admin", "Hem"],
  ["/admin/ordrar", "Beställningar"],
  ["/admin/produkter", "Produkter"],
  ["/admin/lager", "Lager"],
  ["/admin/innehall", "Startsidan"],
  ["/admin/butiker", "Butiker"],
  ["/admin/logg", "Lagerlogg"],
  ["/admin/installningar", "Inställningar"],
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.json()).then((data) => setEmail(data.user?.email ?? null));
  }, [path]);

  useEffect(() => {
    if (email === null && path !== "/admin/login") router.replace("/admin/login");
    if (email && path === "/admin/login") router.replace("/admin");
  }, [email, path, router]);

  function go(href: string) {
    if (dirty && !window.confirm("Du har osparade ändringar. Vill du lämna sidan ändå?")) return;
    setDirty(false);
    router.push(href);
  }

  if (path === "/admin/login") return <>{children}</>;
  if (!email) return <p className="p-6 text-muted">Hämtar butiken…</p>;

  return (
    <DirtyContext.Provider value={{ dirty, setDirty }}>
      <div className="min-h-screen bg-cream text-ink md:pl-60">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-bark px-3 py-5 text-cream md:flex">
          <Link href="/admin" className="flex items-center gap-2 px-2 font-display text-2xl" onClick={(event) => { event.preventDefault(); go("/admin"); }}>
            <AfricaMark className="h-6 w-5 text-gold" /> AfroCorner
          </Link>
          <p className="mt-1 px-2 text-xs text-[#f6efe4]/70">Butikens verktyg</p>
          <nav className="mt-6 flex flex-1 flex-col gap-1">
            {SIDE.map(([href, label]) => {
              const active = href === "/admin" ? path === href : path.startsWith(href);
              return (
                <button key={href} type="button" onClick={() => go(href)} className={`h-12 rounded-2xl px-3 text-left text-sm ${active ? "bg-gold font-medium text-bark" : "hover:bg-white/10"}`}>
                  {label}
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            className="h-12 rounded-2xl px-3 text-left text-sm text-[#f6efe4]/80"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/admin/login");
            }}
          >
            Logga ut
          </button>
        </aside>
        <div className="px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-6">{children}</div>
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-paper md:hidden" aria-label="Admin">
          {TABS.map((tab) => {
            const active = tab.match(path);
            const Icon = tab.icon;
            return (
              <button key={tab.href} type="button" onClick={() => go(tab.href)} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? "text-bark" : "text-muted"}`} aria-current={active ? "page" : undefined}>
                <Icon className={`h-5 w-5 ${active ? "text-gold-deep" : ""}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </DirtyContext.Provider>
  );
}
