// ─── One fragrance. Multiple ways to experience it. ──────────────────────────
//
// The fragrance is the master product; each way of buying it is a format (SKU).
// Per-fragrance overrides (price / status / stock) live on the Fragrance row;
// house defaults live here so a new scent instantly has every format.

import { type Fragrance, type FormatKey, type FormatStatus, money } from "./data";

export type FormatGroup = "wear" | "drive" | "live" | "ritual";

export interface FormatDef {
  key: FormatKey;
  group: FormatGroup;
  label: string; // "50ml"
  name: string; // "Eau de Parfum 50ml"
  short: string; // chip text: "50ml", "CAR"
  sizeMl: number; // recorded on the commit row
  sku: string; // suffix — SMOKY-PERF-50
  defaultPrice: number | null; // cents; null = derived (perfume sizes, ritual)
  defaultStatus: FormatStatus;
}

export const GROUPS: Record<FormatGroup, { title: string; sub: string; verb: string }> = {
  wear: { title: "Wear it", sub: "Eau de Parfum", verb: "Wear" },
  drive: { title: "Drive with it", sub: "Car diffuser", verb: "Drive" },
  live: { title: "Live in it", sub: "Body care", verb: "Ritual" },
  ritual: { title: "Complete the ritual", sub: "Curated set", verb: "Set" },
};

export const FORMATS: FormatDef[] = [
  { key: "perf10", group: "wear", label: "10ml", name: "Eau de Parfum 10ml", short: "10ml", sizeMl: 10, sku: "PERF-10", defaultPrice: null, defaultStatus: "live" },
  { key: "perf30", group: "wear", label: "30ml", name: "Eau de Parfum 30ml", short: "30ml", sizeMl: 30, sku: "PERF-30", defaultPrice: null, defaultStatus: "live" },
  { key: "perf50", group: "wear", label: "50ml", name: "Eau de Parfum 50ml", short: "50ml", sizeMl: 50, sku: "PERF-50", defaultPrice: null, defaultStatus: "live" },
  { key: "car", group: "drive", label: "Car Diffuser", name: "Car Diffuser 10ml", short: "CAR", sizeMl: 10, sku: "CAR-10", defaultPrice: 1000, defaultStatus: "live" },
  { key: "wash", group: "live", label: "Body Wash", name: "Body Wash 300ml", short: "WASH", sizeMl: 300, sku: "WASH", defaultPrice: 4200, defaultStatus: "coming_soon" },
  { key: "moist", group: "live", label: "Moisturiser", name: "Body Moisturiser 300ml", short: "BODY", sizeMl: 300, sku: "MOIST", defaultPrice: 4800, defaultStatus: "coming_soon" },
  { key: "ritual", group: "ritual", label: "The Complete Ritual", name: "The Complete Ritual (4 pieces)", short: "SET", sizeMl: 50, sku: "RITUAL", defaultPrice: null, defaultStatus: "coming_soon" },
];

export const FORMAT_BY_KEY: Record<FormatKey, FormatDef> = Object.fromEntries(FORMATS.map((f) => [f.key, f])) as Record<FormatKey, FormatDef>;

/** Bundles are intelligent: the Ritual is made of real SKUs, not its own stock. */
export const RITUAL_PARTS: FormatKey[] = ["perf50", "wash", "moist"];
export const RITUAL_DISCOUNT = 0.15;

export interface Sku {
  key: FormatKey;
  def: FormatDef;
  code: string; // SMOKY-OBSIDIAN-PERF-50
  price: number; // cents
  compareAt?: number; // cents, pre-discount (ritual)
  status: FormatStatus;
  stock: number;
  /** Purchasable right now (live and stocked, or a made-to-order perfume batch). */
  buyable: boolean;
  /** Short availability copy for the product page. */
  availability: string;
}

function rawStock(f: Fragrance, key: FormatKey): number {
  switch (key) {
    case "perf10": return f.stock10 ?? 0;
    case "perf30": return f.stock30 ?? 0;
    case "perf50": return f.stock50 ?? 0;
    case "car": return f.stockCar ?? 0;
    case "wash": return f.stockWash ?? 0;
    case "moist": return f.stockMoist ?? 0;
    case "ritual": return Math.min(...RITUAL_PARTS.map((k) => rawStock(f, k)));
  }
}

export function formatPrice(f: Fragrance, key: FormatKey): number {
  const override = f.formatPrices?.[key];
  if (override != null && override > 0) return override;
  switch (key) {
    case "perf10": return f.price10;
    case "perf30": return f.price30;
    case "perf50": return f.price;
    case "ritual": return Math.round((RITUAL_PARTS.reduce((s, k) => s + formatPrice(f, k), 0) * (1 - RITUAL_DISCOUNT)) / 100) * 100;
    default: return FORMAT_BY_KEY[key].defaultPrice ?? 0;
  }
}

export function formatStatus(f: Fragrance, key: FormatKey): FormatStatus {
  const own = f.formatStatus?.[key] ?? FORMAT_BY_KEY[key].defaultStatus;
  if (key !== "ritual") return own;
  // The set can only be live when every part is live.
  const parts = RITUAL_PARTS.map((k) => formatStatus(f, k));
  if (parts.includes("hidden")) return "hidden";
  if (parts.includes("coming_soon")) return own === "hidden" ? "hidden" : "coming_soon";
  return own;
}

export function sku(f: Fragrance, key: FormatKey): Sku {
  const def = FORMAT_BY_KEY[key];
  const status = formatStatus(f, key);
  const stock = rawStock(f, key);
  const price = formatPrice(f, key);
  const compareAt = key === "ritual" ? RITUAL_PARTS.reduce((s, k) => s + formatPrice(f, k), 0) : undefined;
  // Perfume and car diffusers are filled from the same oil on demand, so they
  // stay orderable at zero stock (they join the next batch); body care ships
  // from finished stock only.
  const perfume = def.group === "wear" || def.group === "drive";
  const buyable = status === "live" && (stock > 0 || perfume);
  const availability =
    status === "coming_soon"
      ? "Coming soon"
      : status === "hidden"
        ? "Unavailable"
        : stock > 0
          ? "In stock · Ships within 1–2 business days"
          : perfume
            ? "Made to order · joins the next batch pour"
            : "Sold out";
  return { key, def, code: `${f.slug.toUpperCase()}-${def.sku}`, price, compareAt, status, stock, buyable, availability };
}

/** Every visible SKU of a fragrance, in display order. */
export function skus(f: Fragrance): Sku[] {
  return FORMATS.map((d) => sku(f, d.key)).filter((s) => s.status !== "hidden");
}

export function skusInGroup(f: Fragrance, group: FormatGroup): Sku[] {
  return skus(f).filter((s) => s.def.group === group);
}

/** Cheapest live way in — "From $39". */
export function fromPrice(f: Fragrance): number {
  const live = skus(f).filter((s) => s.status === "live");
  return Math.min(...(live.length ? live : skus(f)).map((s) => s.price));
}

export function fromLabel(f: Fragrance): string {
  return `From ${money(fromPrice(f))}`;
}

/** Which of Perfume / Car / Body / Set exist (live or coming) for card chips. */
export function availableIn(f: Fragrance): { group: FormatGroup; label: string; status: FormatStatus }[] {
  const out: { group: FormatGroup; label: string; status: FormatStatus }[] = [];
  (["wear", "drive", "live", "ritual"] as FormatGroup[]).forEach((g) => {
    const list = skusInGroup(f, g);
    if (!list.length) return;
    const status: FormatStatus = list.some((s) => s.status === "live") ? "live" : "coming_soon";
    out.push({ group: g, label: g === "wear" ? "Perfume" : g === "drive" ? "Car" : g === "live" ? "Body" : "Set", status });
  });
  return out;
}

// ─── Scent taxonomy: moods, families, experience ─────────────────────────────

export type Mood = "Woody" | "Fresh" | "Spicy" | "Dark" | "Clean" | "Floral" | "Sweet" | "Gourmand" | "Evening" | "Summer";

export const MOODS: { id: Mood; hint: string; swatch: string }[] = [
  { id: "Woody", hint: "cedar, sandalwood, vetiver", swatch: "#6b4a2b" },
  { id: "Fresh", hint: "citrus, sea air, green", swatch: "#4c8a5e" },
  { id: "Spicy", hint: "pepper, cinnamon, saffron", swatch: "#9a4a25" },
  { id: "Dark", hint: "oud, smoke, resin", swatch: "#2a2028" },
  { id: "Clean", hint: "musk, cotton, aldehydes", swatch: "#8d9aa8" },
  { id: "Floral", hint: "rose, jasmine, iris", swatch: "#b06a8c" },
  { id: "Sweet", hint: "vanilla, tonka, amber", swatch: "#b8863c" },
  { id: "Gourmand", hint: "coffee, caramel, praline", swatch: "#7a4b2a" },
  { id: "Evening", hint: "intense, statement, night", swatch: "#3b3352" },
  { id: "Summer", hint: "bright, airy, aquatic", swatch: "#3f86a8" },
];

const MOOD_TERMS: Record<Mood, string[]> = {
  Woody: ["wood", "cedar", "sandal", "vetiver", "oud", "ebony", "guaiac", "birch", "oak", "patchouli", "pine", "fir"],
  Fresh: ["bergamot", "citrus", "lemon", "lime", "grapefruit", "mandarin", "green", "mint", "sea", "marine", "aquatic", "apple", "pear", "cucumber", "ginger", "fresh"],
  Spicy: ["pepper", "cinnamon", "clove", "cardamom", "saffron", "nutmeg", "spice", "spicy", "pimento", "ginger"],
  Dark: ["oud", "smoke", "smoky", "incense", "resin", "leather", "ink", "tar", "birch", "dark", "olibanum", "labdanum", "black"],
  Clean: ["musk", "cotton", "aldehyde", "iris", "clean", "linen", "soap", "white tea", "ambrette"],
  Floral: ["rose", "jasmine", "iris", "violet", "peony", "orange blossom", "tuberose", "lily", "neroli", "gardenia", "ylang", "floral", "lavender", "magnolia"],
  Sweet: ["vanilla", "tonka", "amber", "honey", "benzoin", "sugar", "sweet", "praline", "caramel"],
  Gourmand: ["coffee", "caramel", "praline", "chocolate", "cacao", "almond", "hazelnut", "rum", "whisky", "cognac", "gourmand"],
  Evening: ["oud", "amber", "leather", "incense", "vanilla", "smok", "intense", "seductive", "night", "evening"],
  Summer: ["citrus", "marine", "sea", "aquatic", "bergamot", "grapefruit", "coconut", "fig", "neroli", "summer", "mint"],
};

function haystack(f: Fragrance): string {
  return [f.name, f.tagline, f.story, f.inspiration, ...(f.profile ?? []), ...f.top, ...f.heart, ...f.base].join(" ").toLowerCase();
}

/** Moods a fragrance belongs to, strongest first (max 4). */
export function moodsOf(f: Fragrance): Mood[] {
  const h = haystack(f);
  return MOODS.map((m) => ({ m: m.id, n: MOOD_TERMS[m.id].filter((t) => h.includes(t)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map((x) => x.m);
}

/** Three-word profile shown under the name: stored, else derived from moods. */
export function profileOf(f: Fragrance): string[] {
  if (f.profile && f.profile.length) return f.profile.slice(0, 3);
  const m = moodsOf(f);
  const derived = m.filter((x) => x !== "Evening" && x !== "Summer").slice(0, 2);
  const family = f.gender === "feminine" ? "Refined" : f.gender === "masculine" ? "Bold" : "Versatile";
  return [...derived, family].slice(0, 3);
}

export interface Experience {
  label: string;
  icon: "flame" | "moon" | "star" | "hourglass" | "tree" | "sun" | "drop" | "leaf";
}

/** Five experience descriptors for the product page icon row. */
export function experienceOf(f: Fragrance): Experience[] {
  const m = moodsOf(f);
  const out: Experience[] = [];
  out.push(m.includes("Dark") || m.includes("Spicy") ? { label: "Bold", icon: "flame" } : { label: "Soft", icon: "drop" });
  out.push(m.includes("Evening") ? { label: "Evening", icon: "moon" } : { label: "Daytime", icon: "sun" });
  out.push({ label: f.vipOnly ? "Rare" : "Statement", icon: "star" });
  out.push({ label: "Long-lasting", icon: "hourglass" });
  out.push(m.includes("Woody") ? { label: "Woody", icon: "tree" } : m.includes("Fresh") || m.includes("Summer") ? { label: "Fresh", icon: "leaf" } : { label: m[0] ?? "Warm", icon: "leaf" });
  return out;
}

/** "Inspired by Tom Ford - Black Lacquer" → { brand, fragrance }. */
export function referenceOf(f: Fragrance): { brand: string; fragrance: string } {
  const s = f.inspiration.replace(/^inspired by\s*/i, "").replace(/^the scent profile of\s*/i, "");
  const m = s.match(/^(.*?)\s*[-–—]\s*(.*)$/);
  return m ? { brand: m[1].trim(), fragrance: m[2].trim() } : { brand: s.trim(), fragrance: "" };
}

export function referenceLine(f: Fragrance): string {
  const r = referenceOf(f);
  return r.fragrance ? `Inspired by the scent profile of ${r.brand} ${r.fragrance}` : `Inspired by the scent profile of ${r.brand}`;
}

// ─── Find your Obsidian: match a fragrance or brand the customer knows ───────

export interface Match {
  frag: Fragrance;
  score: number; // 0..1
  percent: number; // 0..100 presentation score
  reason: string;
}

const STOP = new Set(["the", "de", "by", "eau", "parfum", "edp", "edt", "pour", "homme", "femme", "for", "and", "of", "intense", "absolu", "le", "la"]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/**
 * Scores every fragrance against a free-text query ("Black Lacquer", "YSL Y",
 * "smoky leather for evenings"). Reference brand + fragrance names weigh most,
 * then house name, then notes and moods. Returns the top matches.
 */
export function findMatches(query: string, frags: Fragrance[], limit = 3): Match[] {
  const q = tokens(query);
  if (!q.length) return [];
  const qJoined = q.join(" ");
  const scored = frags.map((f) => {
    const ref = referenceOf(f);
    const refTokens = tokens(`${ref.brand} ${ref.fragrance}`);
    const nameTokens = tokens(f.name);
    const noteTokens = tokens([...f.top, ...f.heart, ...f.base, ...(f.profile ?? [])].join(" "));
    const moodTokens = moodsOf(f).map((m) => m.toLowerCase());
    let score = 0;
    const reasons: string[] = [];
    // Whole-phrase hits on the reference are near-certain matches.
    const refPhrase = `${ref.brand} ${ref.fragrance}`.toLowerCase();
    if (ref.fragrance && refPhrase.includes(qJoined)) {
      score += 1;
      reasons.push(`the profile of ${ref.brand} ${ref.fragrance}`);
    } else if (ref.fragrance && qJoined.includes(ref.fragrance.toLowerCase())) {
      score += 0.9;
      reasons.push(`the profile of ${ref.brand} ${ref.fragrance}`);
    }
    for (const t of q) {
      if (refTokens.includes(t)) score += 0.35;
      else if (refTokens.some((r) => r.startsWith(t) || t.startsWith(r))) score += 0.18;
      if (nameTokens.includes(t)) score += 0.3;
      if (noteTokens.includes(t)) {
        score += 0.15;
        reasons.push(t);
      } else if (noteTokens.some((n) => n.startsWith(t))) score += 0.08;
      if (moodTokens.includes(t)) {
        score += 0.15;
        reasons.push(`${t} mood`);
      }
    }
    return { f, score, reasons };
  });
  const top = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  if (!top.length) return [];
  const best = top[0].score;
  return top.map(({ f, score, reasons }) => ({
    frag: f,
    score: Math.min(1, score),
    percent: Math.round(Math.min(97, 60 + 37 * Math.min(1, score / Math.max(best, 1)))),
    reason: reasons.length ? `Matched on ${[...new Set(reasons)].slice(0, 3).join(", ")}` : "Closest profile in the house",
  }));
}

/** Related scents: same moods, then same gender. */
export function relatedTo(f: Fragrance, frags: Fragrance[], limit = 4): Fragrance[] {
  const mine = new Set(moodsOf(f));
  return frags
    .filter((x) => x.id !== f.id)
    .map((x) => ({ x, n: moodsOf(x).filter((m) => mine.has(m)).length + (x.gender === f.gender ? 0.5 : 0) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((r) => r.x);
}

// ─── Discovery box ───────────────────────────────────────────────────────────
export const DISCOVERY_BOX_SIZE = 5;
export const DISCOVERY_BOX_PRICE = 5000; // cents — five 10ml discoveries
