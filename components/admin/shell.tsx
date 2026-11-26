"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AfricaMark } from "@/components/AfricaMark";

const LINKS = [
  ["/admin", "Översikt"],
  ["/admin/produkter", "Produkter"],
  ["/admin/lager", "Lager"],
  ["/admin/salt", "Sålt i butik"],
  ["/admin/ordrar", "Ordrar"],
  ["/admin/innehall", "Innehåll"],
  ["/admin/sumup", "SumUp"],
  ["/admin/logg", "Logg"],
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.json()).then((data) => setEmail(data.user?.email ?? null));
  }, [path]);

  useEffect(() => {
    if (email === null && path !== "/admin/login") router.replace("/admin/login");
    if (email && path === "/admin/login") router.replace("/admin");
  }, [email, path, router]);

  if (path === "/admin/login") return <>{children}</>;
  if (!email) return <p className="p-6 text-muted">Hämtar butiken…</p>;

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-30 border-b border-line bg-bark text-cream">
        <div className="flex items-center justify-between px-3 py-3">
          <Link href="/admin" className="flex items-center gap-2 font-display text-xl">
            <AfricaMark className="h-5 w-5 text-gold" /> AfroCorner
          </Link>
          <button
            type="button"
            className="text-sm"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/admin/login");
              router.refresh();
            }}
          >
            Logga ut
          </button>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3">
          {LINKS.map(([href, label]) => {
            const active = href === "/admin" ? path === href : path.startsWith(href);
            return (
              <Link key={href} href={href} className={`shrink-0 rounded-full px-3 py-2 text-sm ${active ? "bg-gold text-bark" : "bg-white/10"}`}>
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="mx-auto w-full max-w-3xl px-3 py-5">{children}</div>
    </div>
  );
}
