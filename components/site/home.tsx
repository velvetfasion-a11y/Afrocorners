"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { homepageTiles } from "@/lib/types";
import { IconTextRow } from "./shell";
import { ProductCard } from "./product-card";
import { useShop } from "./shell";

export function HomePage() {
  const { content, products } = useShop();
  const slides = content.heroSlides;
  const [index, setIndex] = useState(0);
  const offers = products.filter((product) => product.offer).sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 6);
  const slide = slides[index] ?? slides[0];

  function go(next: number) {
    if (slides.length === 0) return;
    const target = (next + slides.length) % slides.length;
    const image = new window.Image();
    const commit = () => setIndex(target);
    image.src = slides[target].image;
    if (image.complete) commit();
    else {
      image.onload = commit;
      image.onerror = commit;
    }
  }

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => go(index + 1), 7000);
    return () => window.clearInterval(id);
    // The interval always advances from the current slide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides.length]);

  return (
    <div>
      <section className="relative min-h-[32rem] overflow-hidden bg-bark text-[#f6efe4] md:min-h-[36rem]">
        {slides.map((item, itemIndex) => (
          <img
            key={item.id}
            src={item.image}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover object-[72%_center] transition-opacity duration-200 ${itemIndex === index ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-bark/80 via-bark/45 to-transparent" />
        {slide && (
          <div className="relative z-10 flex min-h-[32rem] items-center md:min-h-[36rem]">
            <div className="wrap py-16">
              <div className="max-w-md">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold">{slide.eyebrow}</p>
                <h1 className="mt-4 whitespace-pre-line font-display text-5xl font-medium leading-[1.05] md:text-6xl">{slide.title}</h1>
                <p className="mt-4 max-w-sm text-base text-[#f6efe4]/90">{slide.text}</p>
                <Link href={slide.buttonHref} className="gold-btn mt-7 inline-flex h-12 items-center rounded-full px-6 font-medium">
                  {slide.buttonLabel} <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
        {slides.length > 1 && (
          <>
            <button type="button" aria-label="Föregående" className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-paper/80 text-ink md:grid" onClick={() => go(index - 1)}>
              <ChevronLeft />
            </button>
            <button type="button" aria-label="Nästa" className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-paper/80 text-ink md:grid" onClick={() => go(index + 1)}>
              <ChevronRight />
            </button>
            <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2">
              {slides.map((item, itemIndex) => (
                <button key={item.id} type="button" aria-label={`Bild ${itemIndex + 1}`} aria-current={itemIndex === index} className={`h-2 rounded-full ${itemIndex === index ? "w-6 bg-paper" : "w-2 bg-paper/60"}`} onClick={() => go(itemIndex)} />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="wrap py-8">
        <IconTextRow items={content.features} />
      </section>

      <section id="kategorier" className="wrap pb-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
          {homepageTiles(content.categories).map((category) => (
            <Link key={category.id} href={category.href} className="group min-w-0 text-center">
              <span className="relative block overflow-hidden rounded-[1.1rem] bg-cream-2 shadow-[0_8px_24px_rgba(60,40,20,0.06)] sm:rounded-[1.3rem]">
                <img src={category.image} alt="" className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                {category.id === "nyheter" && (
                  <span className="absolute right-1.5 top-2 rotate-6 rounded-sm bg-[#f3d392] px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-bark sm:right-2 sm:top-3 sm:px-2 sm:py-1 sm:text-[10px]">NYHETER</span>
                )}
              </span>
              <span className="mt-2 block text-balance text-[11px] font-medium leading-snug text-ink sm:text-sm">{category.name} ›</span>
            </Link>
          ))}
        </div>
      </section>

      {content.campaigns.length > 0 && (
        <section className="wrap py-8">
          <div className={`grid gap-4 ${content.campaigns.length > 1 ? "lg:grid-cols-2" : ""}`}>
            {content.campaigns.map((card) => (
              <article key={card.id} className="grid overflow-hidden rounded-[1.6rem] bg-bark text-[#f6efe4] md:grid-cols-2">
                <div className="flex flex-col justify-center p-6 md:p-8">
                  <h2 className="font-display text-4xl leading-tight">{card.title}</h2>
                  <p className="mt-3 max-w-xs text-sm text-[#f6efe4]/85">{card.text}</p>
                  <Link href={card.buttonHref} className="gold-btn mt-6 inline-flex h-11 w-fit items-center rounded-full px-5 text-sm font-medium">
                    {card.buttonLabel} <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>
                <img src={card.image} alt="" className="h-56 w-full object-cover md:h-full" />
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="wrap pb-4 pt-4">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2 className="font-display text-4xl">Aktuella erbjudanden</h2>
          <Link href="/erbjudanden" className="shrink-0 text-sm font-medium text-brown hover:underline">Se alla offerter →</Link>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 xl:grid-cols-6">
          {offers.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
