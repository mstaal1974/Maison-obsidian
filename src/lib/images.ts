import type { Fragrance } from "./data";

/**
 * Bottle render for a fragrance. An image uploaded from the admin console wins;
 * otherwise the convention is a transparent PNG in public/assets named after
 * the slug (smoky-obsidian.png). BottleImage falls back to the stock photo if
 * neither loads.
 */
export function bottleImage(f: Pick<Fragrance, "imageUrl" | "slug">): string {
  return f.imageUrl || `/assets/${encodeURIComponent(f.slug)}.png`;
}
