"use client";

import { useEffect, useState } from "react";
import { PhotoPicker } from "@/components/admin/crop";
import { InlineNote, Loading, moveItem, useCatalog, useWarnIfDirty } from "@/components/admin/bits";
import { useAdminDirty } from "@/components/admin/shell";
import { api } from "@/components/admin/api";
import { Input, Label, Textarea } from "@/components/ui/input";
import { homepageTiles, type CampaignCard, type HeroSlide, type SiteContent } from "@/lib/types";

type Section = "info" | "hero" | "categories" | "campaign" | "features" | "footer";

export function ContentForm() {
  const { data, reload } = useCatalog();
  const { setDirty } = useAdminDirty();
  const [content, setContent] = useState<SiteContent | null>(null);
  const [baseline, setBaseline] = useState("");
  const [section, setSection] = useState<Section | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const dirty = Boolean(content && baseline && JSON.stringify(content) !== baseline);
  useWarnIfDirty(dirty);
  useEffect(() => { setDirty(dirty); }, [dirty, setDirty]);
  useEffect(() => {
    if (!data) return;
    const copy = structuredClone(data.content);
    setContent(copy);
    setBaseline(JSON.stringify(copy));
  }, [data]);

  function patch(partial: Partial<SiteContent>) {
    setSaved("");
    setContent((current) => current ? { ...current, ...partial } : current);
  }

  async function save() {
    if (!content) return;
    setError("");
    try {
      await api("/api/content", { method: "PUT", body: JSON.stringify(content) });
      setBaseline(JSON.stringify(content));
      setSaved("Startsidan är sparad. Kunderna ser den direkt.");
      reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunde inte spara.");
    }
  }

  if (!content) return <Loading label="Hämtar startsidan…" />;
  return (
    <div className="mx-auto max-w-3xl pb-28">
      <h1 className="font-display text-4xl">Startsidan</h1>
      <p className="mt-1 text-sm text-muted">Tryck på den del du vill ändra. Förhandsvisningen uppdateras medan du skriver.</p>
      <Preview content={content} active={section} onPick={setSection} />
      {section && (
        <div className="mt-4 rounded-3xl bg-paper p-4">
          {section === "info" && <InfoEditor content={content} patch={patch} />}
          {section === "hero" && <HeroEditor content={content} patch={patch} />}
          {section === "categories" && <CategoryEditor content={content} patch={patch} />}
          {section === "campaign" && <CampaignEditor content={content} patch={patch} />}
          {section === "features" && <LinesEditor title="Raderna under bilden" items={content.features} onChange={(features) => patch({ features })} />}
          {section === "footer" && <FooterEditor content={content} patch={patch} />}
          <button type="button" className="mt-3 h-11 text-sm underline" onClick={() => setSection(null)}>Stäng</button>
        </div>
      )}
      {error && <div className="mt-3"><InlineNote tone="err">{error}</InlineNote></div>}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-paper/95 p-3 md:bottom-0 md:left-60">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <p className="flex-1 text-sm">{saved || (dirty ? "Osparade ändringar" : "Allt är sparat")}</p>
          <button type="button" className="gold-btn h-12 rounded-full px-6" onClick={save}>Spara startsidan</button>
        </div>
      </div>
    </div>
  );
}

function Preview({ content, active, onPick }: { content: SiteContent; active: Section | null; onPick: (section: Section) => void }) {
  const slide = content.heroSlides[0];
  return (
    <div className="mt-4 overflow-hidden rounded-[1.6rem] border border-line bg-cream">
      <button type="button" className={box(active === "info")} onClick={() => onPick("info")}>{content.infoBar.map((item) => item.text).join(" · ")}</button>
      <button type="button" className={`${box(active === "hero")} relative min-h-36 bg-bark text-left text-[#f6efe4]`} onClick={() => onPick("hero")}>
        {slide && <img src={slide.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
        <span className="relative block p-4">
          <span className="text-xs text-gold">{slide?.eyebrow}</span>
          <span className="mt-1 block whitespace-pre-line font-display text-2xl">{slide?.title}</span>
        </span>
      </button>
      <div className="grid grid-cols-3 gap-2 p-3">
        {homepageTiles(content.categories).map((tile) => (
          <button key={tile.id} type="button" className={box(active === "categories")} onClick={() => onPick("categories")}>
            <img src={tile.image} alt="" className="aspect-square w-full rounded-xl object-cover" />
            <span className="mt-1 block text-xs">{tile.name}</span>
          </button>
        ))}
      </div>
      <button type="button" className={`${box(active === "campaign")} mx-3 mb-3 grid grid-cols-2 overflow-hidden rounded-2xl bg-bark text-left text-[#f6efe4]`} onClick={() => onPick("campaign")}>
        <span className="p-3 font-display text-xl">{content.campaigns[0]?.title || "Ingen kampanj"}</span>
        {content.campaigns[0] && <img src={content.campaigns[0].image} alt="" className="h-full w-full object-cover" />}
      </button>
      <button type="button" className={`${box(active === "features")} mx-3 mb-3 text-left text-sm`} onClick={() => onPick("features")}>{content.features.map((item) => item.text).join(" · ")}</button>
      <button type="button" className={`${box(active === "footer")} text-left text-sm`} onClick={() => onPick("footer")}>{content.footerAbout}</button>
    </div>
  );
}

function box(active: boolean) {
  return `block w-full p-3 ${active ? "ring-2 ring-gold" : ""}`;
}

function InfoEditor({ content, patch }: { content: SiteContent; patch: (partial: Partial<SiteContent>) => void }) {
  return (
    <div className="space-y-2">
      <p className="font-medium">Informationsraden längst upp</p>
      {content.infoBar.map((item, index) => (
        <Input key={item.id} className="h-12" value={item.text} aria-label={`Rad ${index + 1}`} onChange={(event) => {
          const infoBar = [...content.infoBar];
          infoBar[index] = { ...item, text: event.target.value };
          patch({ infoBar });
        }} />
      ))}
    </div>
  );
}

function HeroEditor({ content, patch }: { content: SiteContent; patch: (partial: Partial<SiteContent>) => void }) {
  const [drag, setDrag] = useState<number | null>(null);
  function setSlides(heroSlides: HeroSlide[]) { patch({ heroSlides }); }
  return (
    <div className="space-y-4">
      <p className="font-medium">Stora bilden</p>
      <p className="text-sm text-muted">Dra i handtaget för att byta ordning.</p>
      {content.heroSlides.map((slide, index) => (
        <div
          key={slide.id}
          className="space-y-2 rounded-2xl bg-cream p-3"
          onPointerDown={(event) => {
            if (!(event.target as HTMLElement).dataset.handle) return;
            setDrag(index);
          }}
          onPointerMove={(event) => {
            if (drag === null) return;
            const rows = [...(event.currentTarget.parentElement?.children ?? [])].filter((node) => node.className.toString().includes("rounded-2xl"));
            const hit = rows.indexOf(event.currentTarget);
            if (hit >= 0 && drag !== index) {
              setSlides(moveItem(content.heroSlides, drag, index));
              setDrag(index);
            }
          }}
          onPointerUp={() => setDrag(null)}
        >
          <button type="button" data-handle="1" className="h-11 w-full rounded-full bg-paper text-sm">Håll och dra</button>
          <img src={slide.image} alt="" className="h-28 w-full rounded-xl object-cover" />
          <PhotoPicker onUploaded={(url) => { const heroSlides = [...content.heroSlides]; heroSlides[index] = { ...slide, image: url }; setSlides(heroSlides); }} />
          <Input className="h-12" value={slide.eyebrow} aria-label="Liten rad" onChange={(event) => update(index, { eyebrow: event.target.value })} />
          <Textarea value={slide.title} aria-label="Rubrik" onChange={(event) => update(index, { title: event.target.value })} />
          <Textarea value={slide.text} aria-label="Text" onChange={(event) => update(index, { text: event.target.value })} />
          <Input className="h-12" value={slide.buttonLabel} aria-label="Knapp" onChange={(event) => update(index, { buttonLabel: event.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="h-11 rounded-full bg-paper" onClick={() => setSlides(moveItem(content.heroSlides, index, index - 1))}>Upp</button>
            <button type="button" className="h-11 rounded-full bg-paper" onClick={() => setSlides(moveItem(content.heroSlides, index, index + 1))}>Ner</button>
          </div>
        </div>
      ))}
      <button type="button" className="h-12 w-full rounded-full border border-line" onClick={() => setSlides([...content.heroSlides, { id: crypto.randomUUID(), image: content.heroSlides[0]?.image || "", eyebrow: "NY RAD", title: "Rubrik", text: "Text", buttonLabel: "Till butiken", buttonHref: "/#kategorier" }])}>Lägg till bild</button>
    </div>
  );
  function update(index: number, partial: Partial<HeroSlide>) {
    const heroSlides = [...content.heroSlides];
    heroSlides[index] = { ...heroSlides[index], ...partial };
    setSlides(heroSlides);
  }
}

function CategoryEditor({ content, patch }: { content: SiteContent; patch: (partial: Partial<SiteContent>) => void }) {
  return (
    <div className="space-y-3">
      <p className="font-medium">Kategorierna</p>
      {content.categories.map((tile, index) => (
        <div key={tile.id} className="flex gap-3">
          <img src={tile.image} alt="" className="h-16 w-16 rounded-xl object-cover" />
          <div className="flex-1 space-y-2">
            <Input className="h-12" value={tile.name} aria-label={`Namn ${tile.name}`} onChange={(event) => {
              const categories = [...content.categories];
              categories[index] = { ...tile, name: event.target.value };
              patch({ categories });
            }} />
            <PhotoPicker onUploaded={(url) => {
              const categories = [...content.categories];
              categories[index] = { ...tile, image: url };
              patch({ categories });
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CampaignEditor({ content, patch }: { content: SiteContent; patch: (partial: Partial<SiteContent>) => void }) {
  function setCards(campaigns: CampaignCard[]) { patch({ campaigns }); }
  return (
    <div className="space-y-3">
      <p className="font-medium">Kampanjkort</p>
      {content.campaigns.length === 0 && <p className="text-sm text-muted">Inget kort just nu. Lägg till ett om du vill visa ett erbjudande.</p>}
      {content.campaigns.map((card, index) => (
        <div key={card.id} className="space-y-2">
          <Input className="h-12" value={card.title} aria-label="Rubrik" onChange={(event) => update(index, { title: event.target.value })} />
          <Textarea value={card.text} aria-label="Text" onChange={(event) => update(index, { text: event.target.value })} />
          <Input className="h-12" value={card.buttonLabel} aria-label="Knapp" onChange={(event) => update(index, { buttonLabel: event.target.value })} />
          <PhotoPicker onUploaded={(url) => update(index, { image: url })} />
          <button type="button" className="h-11 text-sm text-red-900" onClick={() => { if (window.confirm("Ta bort kampanjkortet?")) setCards(content.campaigns.filter((item) => item.id !== card.id)); }}>Ta bort kort</button>
        </div>
      ))}
      <button type="button" className="h-12 w-full rounded-full border border-line" onClick={() => setCards([...content.campaigns, { id: crypto.randomUUID(), title: "Ny kampanj", text: "Kort text", buttonLabel: "Handla", buttonHref: "/erbjudanden", image: content.categories[0]?.image || "" }])}>Lägg till kort</button>
    </div>
  );
  function update(index: number, partial: Partial<CampaignCard>) {
    const campaigns = [...content.campaigns];
    campaigns[index] = { ...campaigns[index], ...partial };
    setCards(campaigns);
  }
}

function LinesEditor({ title, items, onChange }: { title: string; items: SiteContent["features"]; onChange: (items: SiteContent["features"]) => void }) {
  return (
    <div className="space-y-2">
      <p className="font-medium">{title}</p>
      {items.map((item, index) => (
        <Input key={item.id} className="h-12" value={item.text} aria-label={title} onChange={(event) => {
          const next = [...items];
          next[index] = { ...item, text: event.target.value };
          onChange(next);
        }} />
      ))}
    </div>
  );
}

function FooterEditor({ content, patch }: { content: SiteContent; patch: (partial: Partial<SiteContent>) => void }) {
  return (
    <div className="space-y-3">
      <LinesEditor title="Raderna längst ner" items={content.footerHighlights} onChange={(footerHighlights) => patch({ footerHighlights })} />
      <Label>Text om butiken<Textarea value={content.footerAbout} onChange={(event) => patch({ footerAbout: event.target.value })} /></Label>
    </div>
  );
}
