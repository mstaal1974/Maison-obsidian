// What the homepage features, set in one place.
//
// There is no sales data behind the storefront yet, so the homepage row is a
// curated "Signature scents" selection rather than a "Best sellers" claim.
// Once real sales ranking exists, list the top sellers in FEATURED_SLUGS and
// set FEATURED_FROM_SALES to true: the heading and hero button then say
// "Best sellers". (Badges and labels must stay factual — see the UX plan.)

import type { Fragrance } from "./data";

/** Slugs to feature, in order. Empty: the first four in catalogue order. */
export const FEATURED_SLUGS: string[] = [];

/** True only when FEATURED_SLUGS comes from actual sales ranking. */
export const FEATURED_FROM_SALES = false;

export const FEATURED_LABEL = FEATURED_FROM_SALES ? "Best sellers" : "Signature scents";

/** Up to four featured fragrances a visitor can buy (no VIP-only scents). */
export function featured(fragrances: Fragrance[], count = 4): Fragrance[] {
  const open = fragrances.filter((f) => !f.vipOnly);
  const picked = FEATURED_SLUGS.map((s) => open.find((f) => f.slug === s)).filter((f): f is Fragrance => !!f);
  const rest = open.filter((f) => !picked.includes(f));
  return [...picked, ...rest].slice(0, count);
}
