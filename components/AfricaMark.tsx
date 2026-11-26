import { AFRICA_PATH, AFRICA_VIEWBOX } from "@/lib/africa-path";

/** Filled silhouette of mainland Africa, from Natural Earth coastlines. */
export function AfricaMark({ className }: { className?: string }) {
  return (
    <svg viewBox={AFRICA_VIEWBOX} className={className} aria-hidden="true">
      <path d={AFRICA_PATH} fill="currentColor" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}
