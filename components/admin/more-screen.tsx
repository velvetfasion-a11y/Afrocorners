"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { InlineNote, Loading, useCatalog, useWarnIfDirty } from "@/components/admin/bits";
import { useAdminDirty } from "@/components/admin/shell";
import { api } from "@/components/admin/api";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { SiteContent } from "@/lib/types";

const LINKS = [
  ["/admin/innehall", "Redigera startsidan", "Bilder, texter och kampanj"],
  ["/admin/butiker", "Butiker och öppettider", "Adress, veckoschema och helgdagar"],
  ["/admin/logg", "Lagerlogg", "Vad som sålts, fyllts på och synkats"],
  ["/admin/installningar", "Inställningar", "Telefon, frakt och meddelande till kunden"],
];

export function MoreScreen() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-4xl">Mer</h1>
      <ul className="mt-4 space-y-3">
        {LINKS.map(([href, title, hint]) => (
          <li key={href}>
            <Link href={href} className="block min-h-20 rounded-3xl bg-paper p-4">
              <span className="block font-display text-2xl">{title}</span>
              <span className="mt-1 block text-sm text-muted">{hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const { data, reload } = useCatalog();
  const { setDirty } = useAdminDirty();
  const [content, setContent] = useState<SiteContent | null>(null);
  const [baseline, setBaseline] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const dirty = Boolean(content && baseline && JSON.stringify(slice(content)) !== baseline);
  useWarnIfDirty(dirty);
  useEffect(() => { setDirty(dirty); }, [dirty, setDirty]);
  useEffect(() => {
    if (!data) return;
    setContent(structuredClone(data.content));
    setBaseline(JSON.stringify(slice(data.content)));
  }, [data]);
  if (!content) return <Loading label="Hämtar inställningar…" />;

  function patch(partial: Partial<SiteContent>) {
    setSaved("");
    setContent((current) => current ? { ...current, ...partial } : current);
  }

  return (
    <div className="mx-auto max-w-xl pb-28">
      <h1 className="font-display text-4xl">Inställningar</h1>
      <p className="mt-1 text-sm text-muted">Det här styr telefonnumret kunden skriver till, och texten i meddelandet.</p>
      <div className="mt-4 space-y-3">
        <Label>Telefon till butiken<Input className="h-12" value={content.ownerPhone} onChange={(event) => patch({ ownerPhone: event.target.value })} /></Label>
        <Label>E-post<Input className="h-12" value={content.footerEmail} onChange={(event) => patch({ footerEmail: event.target.value })} /></Label>
        <Label>Fri frakt från (kr)<Input className="h-12" type="number" value={content.freeShippingThreshold} onChange={(event) => patch({ freeShippingThreshold: Number(event.target.value) })} /></Label>
        <Label>Meddelande till kunden
          <span className="mt-1 block text-sm font-normal text-muted">Orden {"{{items}} {{total}} {{fulfilment}} {{customer}} {{number}}"} byts ut mot ordern.</span>
          <Textarea className="min-h-40" value={content.messageTemplate} onChange={(event) => patch({ messageTemplate: event.target.value })} />
        </Label>
      </div>
      {error && <div className="mt-3"><InlineNote tone="err">{error}</InlineNote></div>}
      <button type="button" className="mt-6 h-12 w-full rounded-full border border-line" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/admin/login"); }}>Logga ut</button>
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-paper/95 p-3 md:bottom-0 md:left-60">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <p className="flex-1 text-sm">{saved || (dirty ? "Osparade ändringar" : "Allt är sparat")}</p>
          <button type="button" className="gold-btn h-12 rounded-full px-6" onClick={async () => {
            if (!content) return;
            try {
              await api("/api/content", { method: "PUT", body: JSON.stringify(content) });
              setBaseline(JSON.stringify(slice(content)));
              setSaved("Sparat.");
              reload();
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Kunde inte spara.");
            }
          }}>Spara</button>
        </div>
      </div>
    </div>
  );
}

function slice(content: SiteContent) {
  return { ownerPhone: content.ownerPhone, footerEmail: content.footerEmail, freeShippingThreshold: content.freeShippingThreshold, messageTemplate: content.messageTemplate };
}
