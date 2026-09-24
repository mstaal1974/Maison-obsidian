// New arrivals. A fragrance's launch date (fragrances.launch_at, set in the
// admin console) decides three things:
//   • before it: not launched — out of the collection and the checkout
//     (api/_lib/catalogue.ts refuses it too); its page is a Coming soon
//     teaser with a waitlist sign-up
//   • for NEW_DAYS after it: "New" — badge, /new, Just poured, the New filter
//   • no date, or older: an established scent
import type { Fragrance } from "./data";

export const NEW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function launchTime(f: Pick<Fragrance, "launchAt">): number | null {
  if (!f.launchAt) return null;
  const t = Date.parse(f.launchAt);
  return Number.isNaN(t) ? null : t;
}

/** Visible and for sale: no launch date, or one that has arrived. */
export function isLaunched(f: Pick<Fragrance, "launchAt">, now = Date.now()): boolean {
  const t = launchTime(f);
  return t === null || t <= now;
}

/** Launched within the last NEW_DAYS days. */
export function isNew(f: Pick<Fragrance, "launchAt">, now = Date.now()): boolean {
  const t = launchTime(f);
  return t !== null && t <= now && now - t < NEW_DAYS * DAY_MS;
}

/** The new arrivals, most recent launch first. */
export function newArrivals<T extends Pick<Fragrance, "launchAt">>(frags: T[], now = Date.now()): T[] {
  return frags.filter((f) => isNew(f, now)).sort((a, b) => (launchTime(b) ?? 0) - (launchTime(a) ?? 0));
}

/** Not launched yet: has a launch date still to come. */
export function isUpcoming(f: Pick<Fragrance, "launchAt">, now = Date.now()): boolean {
  const t = launchTime(f);
  return t !== null && t > now;
}

/** Launching soonest first. */
export function upcoming(frags: Fragrance[], now = Date.now()): Fragrance[] {
  return frags.filter((f) => isUpcoming(f, now)).sort((a, b) => (launchTime(a) ?? 0) - (launchTime(b) ?? 0));
}

/** "12 October" (with the year when it isn't this one). */
export function launchLabel(f: Pick<Fragrance, "launchAt">, now = Date.now()): string {
  const t = launchTime(f);
  if (t === null) return "";
  const d = new Date(t);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  if (d.getFullYear() !== new Date(now).getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-AU", opts);
}
