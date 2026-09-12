// ─── Scent DNA — the Scentprint™ model, matching engine and Scent Universe™ ───
//
// One numerical language for two things:
//   • a customer's Scentprint  — built from the /discover experience
//   • a fragrance's Scentprint — derived from its notes, so every scent in the
//     house (seed or admin-added) has one without anybody filling in a sheet
//
// Sixteen scent dimensions (0–100) plus eight behavioural attributes. The
// matching engine compares the two with a *weighted* similarity: the
// dimensions a person actually cares about dominate, a fragrance being loud in
// something they never reach for is punished harder than being quiet in
// something they like, and sweetness / intensity / occasion are scored on top.

import { matches as suitsFilter, type Filter, type Fragrance } from "./data";
import { moodsOf } from "./formats";

// ─── Dimensions ──────────────────────────────────────────────────────────────

export const SCENT_DIMS = [
  "fresh", "citrus", "aquatic", "aromatic", "green", "floral", "fruity", "sweet",
  "gourmand", "spicy", "woody", "amber", "musk", "smoky", "powdery", "clean",
] as const;
export type ScentDim = (typeof SCENT_DIMS)[number];
export type ScentVector = Record<ScentDim, number>;

export const DIM_LABEL: Record<ScentDim, string> = {
  fresh: "Fresh",
  citrus: "Citrus",
  aquatic: "Aquatic",
  aromatic: "Aromatic",
  green: "Green",
  floral: "Floral",
  fruity: "Fruity",
  sweet: "Sweet",
  gourmand: "Gourmand",
  spicy: "Spicy",
  woody: "Woody",
  amber: "Amber",
  musk: "Musk",
  smoky: "Leather / Smoky",
  powdery: "Powdery",
  clean: "Clean",
};

/** Tight label for the ring and the share card, where space is the constraint. */
export const DIM_SHORT: Record<ScentDim, string> = { ...DIM_LABEL, smoky: "Leather" };

/** The single word each dimension contributes to a family name ("Fresh Woody"). */
const FAMILY_WORD: Record<ScentDim, string> = {
  ...DIM_LABEL,
  musk: "Musky",
  smoky: "Smoky",
};

/**
 * Perfumery reads light before heavy — "Fresh Woody", never "Woody Fresh" —
 * so a family name sorts its two words by this order, not by raw strength.
 */
const FAMILY_ORDER: ScentDim[] = [
  "fresh", "citrus", "aquatic", "green", "aromatic", "clean", "powdery",
  "fruity", "spicy", "floral", "sweet", "woody", "musk", "amber", "gourmand", "smoky",
];

// ─── Behavioural attributes ──────────────────────────────────────────────────

export const BEHAVIOURS = [
  "projection", "longevity", "sweetness", "intensity",
  "familiarity", "adventurousness", "night", "formality",
] as const;
export type Behaviour = (typeof BEHAVIOURS)[number];
export type BehaviourVector = Record<Behaviour, number>;

export const BEHAVIOUR_LABEL: Record<Behaviour, string> = {
  projection: "Projection",
  longevity: "Longevity",
  sweetness: "Sweetness",
  intensity: "Intensity",
  familiarity: "Familiarity",
  adventurousness: "Adventurousness",
  night: "Day / Night",
  formality: "Casual / Formal",
};

/** Both poles of each axis, so a read-out can say which way the number leans. */
export const BEHAVIOUR_POLES: Record<Behaviour, [string, string]> = {
  projection: ["Personal", "Commanding"],
  longevity: ["Fleeting", "All day"],
  sweetness: ["Dry", "Sweet"],
  intensity: ["Quiet", "Intense"],
  familiarity: ["Unexpected", "Familiar"],
  adventurousness: ["Classic", "Adventurous"],
  night: ["Daylight", "After dark"],
  formality: ["Casual", "Formal"],
};

// ─── Occasions ───────────────────────────────────────────────────────────────

export const OCCASIONS = ["everyday", "work", "weekend", "date", "evening", "special"] as const;
export type OccasionKey = (typeof OCCASIONS)[number];

export const OCCASION_LABEL: Record<OccasionKey, string> = {
  everyday: "Everyday",
  work: "Work",
  weekend: "Weekend",
  date: "Date Night",
  evening: "Evening",
  special: "Special Occasion",
};

/** Where each moment sits on the day↔night and casual↔formal axes. */
const OCCASION_AXES: Record<OccasionKey, { night: number; formality: number }> = {
  everyday: { night: 28, formality: 32 },
  work: { night: 20, formality: 76 },
  weekend: { night: 34, formality: 14 },
  date: { night: 80, formality: 58 },
  evening: { night: 92, formality: 54 },
  special: { night: 74, formality: 90 },
};

// ─── Who it is for ───────────────────────────────────────────────────────────
//
// Asked before anything else, and used for one thing only: which bottles the
// house offers back. It never touches the Scentprint itself — the numbers come
// from what the person actually chose, so two people with the same answers get
// the same profile and a different shelf.

export type Wearer = "him" | "her" | "all";

export const WEARER_LABEL: Record<Wearer, string> = {
  him: "For him",
  her: "For her",
  all: "Everything",
};

const WEARER_FILTER: Record<Wearer, Filter> = { him: "men", her: "women", all: "all" };

/** Masculine and unisex for him, feminine and unisex for her, all of it for all. */
export function wearableBy(f: Fragrance, wearer: Wearer): boolean {
  return suitsFilter(f, WEARER_FILTER[wearer]);
}

/** The shelf a wearer sees. Never empty: an unstocked filter falls back to all. */
export function shelfFor(frags: Fragrance[], wearer: Wearer): Fragrance[] {
  const pool = frags.filter((f) => wearableBy(f, wearer));
  return pool.length ? pool : frags;
}

// ─── The Scentprint ──────────────────────────────────────────────────────────

export interface Scentprint {
  version: 1;
  dims: ScentVector;
  behaviour: BehaviourVector;
  occasions: OccasionKey[];
  /** Which shelf to match against — masculine, feminine, or the whole house. */
  wearer: Wearer;
  /** Optional: a fragrance they already love, as they typed it. */
  loves?: string | null;
  createdAt: string;
}

export function zeroVector(): ScentVector {
  return Object.fromEntries(SCENT_DIMS.map((d) => [d, 0])) as ScentVector;
}

export function clamp(n: number, lo = 0, hi = 100): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/** Strongest dimensions first — the ring only ever shows the top eight to ten. */
export function rankedDims(v: ScentVector, limit: number = SCENT_DIMS.length): { dim: ScentDim; value: number }[] {
  return SCENT_DIMS.map((dim) => ({ dim, value: v[dim] }))
    .sort((a, b) => b.value - a.value || FAMILY_ORDER.indexOf(a.dim) - FAMILY_ORDER.indexOf(b.dim))
    .slice(0, limit);
}

// ─── Note lexicon: notes → dimensions ────────────────────────────────────────
//
// Every note in the catalogue is matched by substring, so "Calabrian Bergamot",
// "Nigerian Ginger" and "Oud (Agarwood)" all land without bespoke entries. A
// note may fire several rules — "Green Apple" is both green and fruity, which
// is exactly right.

const NOTE_DNA: { match: string[]; exclude?: string[]; dna: Partial<ScentVector> }[] = [
  // Citrus & bright fruit
  { match: ["bergamot", "citron", "lemon", "lime", "grapefruit", "mandarin", "orange", "tangerine", "neroli", "yuzu", "citrus", "petitgrain"], dna: { citrus: 1, fresh: 0.8, clean: 0.3 } },
  { match: ["orange blossom", "orange flower", "neroli"], dna: { floral: 0.7, clean: 0.35 } },
  { match: ["pear", "apple", "raspberry", "currant", "peach", "nectarine", "plum", "fig", "coconut", "pineapple", "berry", "cherry", "litchi", "lychee", "melon", "apricot", "red fruits", "fruity"], exclude: ["pineapple & blackcurrant"], dna: { fruity: 1, fresh: 0.35, sweet: 0.3 } },
  // The sheet writes some notes as a pair; score both halves.
  { match: ["pineapple & blackcurrant"], dna: { fruity: 1.2, fresh: 0.4, sweet: 0.3, green: 0.2 } },
  { match: ["green apple"], dna: { green: 0.7, fresh: 0.5 } },
  // Water & air
  { match: ["marine", "sea", "aquatic", "water", "ozon", "salt", "ambergris", "calone", "lotus"], dna: { aquatic: 1, fresh: 0.7, clean: 0.5, musk: 0.3 } },
  { match: ["ambroxan", "ambrox"], dna: { musk: 0.85, clean: 0.6, amber: 0.45, aquatic: 0.35, fresh: 0.3 } },
  // Aromatic & herbal
  { match: ["lavender", "rosemary", "sage", "mint", "basil", "thyme", "juniper", "angelica", "cypress", "eucalypt", "clary", "absinthe", "anise", "fennel", "laurel", "tarragon"], dna: { aromatic: 1, fresh: 0.5, green: 0.35 } },
  { match: ["lavender"], dna: { powdery: 0.35, floral: 0.3 } },
  { match: ["mint", "eucalypt"], dna: { fresh: 0.55, clean: 0.3 } },
  // Green & tea
  { match: ["tea", "galbanum", "grass", "moss", "leaf", "violet leaf", "vetiver", "tomato"], dna: { green: 1, fresh: 0.4, aromatic: 0.3 } },
  { match: ["vetiver"], dna: { woody: 0.8, smoky: 0.25 } },
  { match: ["tea"], dna: { clean: 0.4, aromatic: 0.3 } },
  // Florals
  { match: ["rose"], exclude: ["rosemary", "rosewood"], dna: { floral: 1 } },
  { match: ["jasmine", "violet", "iris", "orris", "peony", "tuberose", "lily", "gardenia", "ylang", "mimosa", "magnolia", "freesia", "muguet", "orchid", "cereus", "blossom", "flower", "floral", "oleander", "hyacinth", "mignonette", "reseda", "cyclamen", "carnation", "osmanthus", "geranium"], dna: { floral: 1 } },
  { match: ["iris", "orris", "violet", "mimosa"], dna: { powdery: 0.85, clean: 0.3 } },
  { match: ["lily-of-the-valley", "muguet", "freesia", "cyclamen", "hyacinth", "mignonette", "reseda"], dna: { clean: 0.55, green: 0.35, fresh: 0.3 } },
  { match: ["jasmine", "tuberose", "ylang", "orchid"], dna: { sweet: 0.3 } },
  { match: ["osmanthus"], dna: { fruity: 0.6 } },
  { match: ["carnation"], dna: { spicy: 0.5 } },
  { match: ["geranium"], dna: { green: 0.6, aromatic: 0.5 } },
  { match: ["davana"], dna: { floral: 0.6, fruity: 0.5, aromatic: 0.4 } },
  // Spice
  { match: ["pepper", "cinnamon", "clove", "cardamom", "saffron", "nutmeg", "pimento", "cumin", "ginger", "spice", "coriander", "elemi"], dna: { spicy: 1 } },
  { match: ["ginger"], dna: { fresh: 0.45, citrus: 0.25 } },
  { match: ["cinnamon", "saffron", "nutmeg"], dna: { amber: 0.4, sweet: 0.25 } },
  // Sweet & amber
  { match: ["vanill", "tonka", "benzoin", "honey", "sugar", "praline", "marshmallow", "heliotrope"], dna: { sweet: 1, gourmand: 0.5, amber: 0.4 } },
  { match: ["vanill", "tonka", "heliotrope"], dna: { powdery: 0.35 } },
  { match: ["amber", "labdanum", "ambergris", "resin", "olibanum", "myrrh", "balsam", "opoponax"], dna: { amber: 1, sweet: 0.3, woody: 0.3 } },
  { match: ["olibanum", "myrrh", "incense", "frankincense"], dna: { smoky: 0.75, spicy: 0.3 } },
  // Gourmand
  { match: ["coffee", "caramel", "toffee", "chocolate", "cacao", "cocoa", "almond", "hazelnut", "pistachio", "rum", "whisky", "cognac", "gourmand", "praline", "coconut", "pastry", "chestnut"], dna: { gourmand: 1, sweet: 0.65 } },
  { match: ["coffee", "cacao", "cocoa", "chocolate"], dna: { smoky: 0.3, spicy: 0.2 } },
  // Woods
  { match: ["wood", "cedar", "sandal", "ebony", "guaiac", "birch", "oak", "pine", "fir", "cypress", "palo santo", "amberwood", "cashmeran", "cypriol"], exclude: ["pineapple"], dna: { woody: 1 } },
  { match: ["amberwood"], dna: { amber: 0.7, musk: 0.35 } },
  { match: ["sandal"], dna: { powdery: 0.4, sweet: 0.25, musk: 0.3 } },
  { match: ["patchouli"], dna: { woody: 0.85, green: 0.35, amber: 0.3, smoky: 0.2 } },
  { match: ["palo santo", "guaiac", "birch", "cypriol"], dna: { smoky: 0.6 } },
  // Dark: leather, smoke, oud, ink
  { match: ["oud", "agarwood"], dna: { woody: 0.9, smoky: 0.9, amber: 0.5, spicy: 0.3 } },
  { match: ["leather", "suede", "castoreum", "birch tar", "black ink", "smoke", "smoky", "tobacco"], dna: { smoky: 1, woody: 0.35, amber: 0.3 } },
  { match: ["tobacco", "rum", "whisky"], dna: { sweet: 0.4, spicy: 0.3 } },
  { match: ["suede"], dna: { powdery: 0.35, musk: 0.3 } },
  // Clean & musk
  { match: ["musk", "ambrette", "cotton", "linen", "soap", "aldehyde", "clean", "white musk"], dna: { musk: 1, clean: 0.8 } },
];

// ─── A fragrance's Scentprint ────────────────────────────────────────────────

/** Moods are already derived house-wide; nudge the vector with what they imply. */
const MOOD_DNA: Record<string, Partial<ScentVector>> = {
  Woody: { woody: 0.9 },
  Fresh: { fresh: 0.9, citrus: 0.4 },
  Spicy: { spicy: 0.9 },
  Dark: { smoky: 0.9, woody: 0.3 },
  Clean: { clean: 0.9, musk: 0.5 },
  Floral: { floral: 0.9 },
  Sweet: { sweet: 0.9, amber: 0.3 },
  Gourmand: { gourmand: 0.9, sweet: 0.5 },
  Evening: { amber: 0.3, smoky: 0.3 },
  Summer: { aquatic: 0.5, citrus: 0.4, fresh: 0.4 },
};

const LAYERS: { key: "top" | "heart" | "base"; weight: number }[] = [
  { key: "top", weight: 0.9 },
  { key: "heart", weight: 1.05 },
  { key: "base", weight: 1.3 },
];

function accumulate(acc: ScentVector, notes: string[], weight: number): number {
  let matched = 0;
  for (const raw of notes) {
    const note = raw.toLowerCase();
    for (const rule of NOTE_DNA) {
      if (!rule.match.some((m) => note.includes(m))) continue;
      if (rule.exclude?.some((x) => note.includes(x))) continue;
      matched += 1;
      for (const dim of SCENT_DIMS) {
        const v = rule.dna[dim];
        if (v) acc[dim] += v * weight;
      }
    }
  }
  return matched;
}

/**
 * Scales an accumulation into 0–100 with the strongest dimension near `peak`.
 * The 0.78 exponent keeps secondary notes legible instead of collapsing them
 * against a dominant base.
 */
function normalise(acc: ScentVector, peak = 92, floor = 4): ScentVector {
  const max = Math.max(...SCENT_DIMS.map((d) => acc[d]));
  const out = zeroVector();
  if (max <= 0) return out;
  for (const d of SCENT_DIMS) {
    if (acc[d] <= 0) continue;
    out[d] = clamp(Math.max(floor, Math.round(peak * Math.pow(acc[d] / max, 0.78))));
  }
  return out;
}

const dnaCache = new Map<string, ScentVector>();

/** The fragrance's own Scentprint, derived from its notes and moods. */
export function fragranceDna(f: Fragrance): ScentVector {
  const key = `${f.id}|${f.top.join(",")}|${f.heart.join(",")}|${f.base.join(",")}|${(f.profile ?? []).join(",")}`;
  const hit = dnaCache.get(key);
  if (hit) return hit;
  const acc = zeroVector();
  let matched = 0;
  for (const layer of LAYERS) matched += accumulate(acc, f[layer.key] ?? [], layer.weight);
  // A fragrance whose notes the lexicon cannot read at all still has to have a
  // body, or it would score as empty against everyone. Only then — one unknown
  // note among eight known ones must not drag the whole scent woody.
  if (matched === 0) {
    acc.woody += 0.9;
    acc.amber += 0.7;
    acc.musk += 0.5;
  }
  for (const mood of moodsOf(f)) {
    const dna = MOOD_DNA[mood];
    if (!dna) continue;
    for (const dim of SCENT_DIMS) {
      const v = dna[dim];
      if (v) acc[dim] += v * 0.55;
    }
  }
  const out = normalise(acc);
  dnaCache.set(key, out);
  return out;
}

/**
 * Runs the note lexicon over free text — a memory, a caption, a sentence of
 * feedback — and returns what it smells of. The same rules the catalogue is
 * read with, so "wet pine and cold stone" lands where a pine-and-mineral
 * fragrance lands. Returns an empty vector when the text says nothing scented.
 */
export function textToDna(text: string): ScentVector {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const acc = zeroVector();
  let matched = 0;
  for (const rule of NOTE_DNA) {
    const hit = rule.match.some((m) => haystack.includes(m));
    if (!hit) continue;
    if (rule.exclude?.some((x) => haystack.includes(x))) continue;
    matched += 1;
    for (const dim of SCENT_DIMS) {
      const v = rule.dna[dim];
      if (v) acc[dim] += v;
    }
  }
  return matched ? normalise(acc) : zeroVector();
}

/** How a fragrance behaves — read off its own dimensions, not hand-tagged. */
export function fragranceBehaviour(v: ScentVector): BehaviourVector {
  const heavy = (v.amber + v.smoky + v.gourmand + v.spicy + v.woody * 0.7 + v.sweet * 0.6) / 4.3;
  const light = (v.fresh + v.citrus + v.aquatic + v.clean + v.green * 0.8) / 4.8;
  const intensity = clamp(50 + (heavy - light) * 0.62);
  const sweetness = clamp(v.sweet * 0.52 + v.gourmand * 0.3 + v.amber * 0.2 + v.fruity * 0.12);
  const odd = (v.smoky + v.spicy * 0.7 + v.gourmand * 0.6 + v.powdery * 0.5 + v.green * 0.4) / 3.2;
  const safe = (v.clean + v.fresh + v.citrus + v.musk * 0.8) / 3.8;
  const adventurousness = clamp(50 + (odd - safe) * 0.6);
  return {
    intensity,
    projection: clamp(intensity * 0.82 + v.smoky * 0.1 + v.sweet * 0.08 + 6),
    longevity: clamp(38 + (v.amber + v.smoky + v.woody + v.gourmand + v.musk) / 5 * 0.72),
    sweetness,
    adventurousness,
    familiarity: clamp(100 - adventurousness),
    night: clamp(50 + ((v.amber + v.smoky + v.gourmand + v.spicy) / 4 - (v.fresh + v.citrus + v.aquatic + v.clean) / 4) * 0.72),
    formality: clamp(50 + ((v.woody + v.powdery + v.smoky * 0.8 + v.amber * 0.6) / 3.4 - (v.fruity + v.gourmand * 0.8 + v.citrus * 0.6) / 2.4) * 0.6),
  };
}

// ─── Matching engine ─────────────────────────────────────────────────────────

/**
 * Not every dimension is equally noticeable. Getting sweetness or smoke wrong
 * ruins a fragrance for someone; being a little off on powder does not.
 */
const DIM_IMPORTANCE: Record<ScentDim, number> = {
  fresh: 1.15,
  citrus: 1,
  aquatic: 0.95,
  aromatic: 0.95,
  green: 0.7,
  floral: 1.1,
  fruity: 0.8,
  sweet: 1.3,
  gourmand: 1.3,
  spicy: 1,
  woody: 1.2,
  amber: 1.1,
  musk: 0.75,
  smoky: 1.25,
  powdery: 0.7,
  clean: 0.9,
};

const BEHAVIOUR_WEIGHT: Partial<Record<Behaviour, number>> = {
  sweetness: 1.3,
  intensity: 1.1,
  projection: 0.9,
  night: 0.9,
  adventurousness: 0.8,
  formality: 0.7,
};

export interface ScentMatch {
  frag: Fragrance;
  dna: ScentVector;
  behaviour: BehaviourVector;
  /** Raw weighted similarity, 0–1. */
  score: number;
  /** Presentation compatibility, 0–100. */
  percent: number;
  /** The dimensions the two of you agree on, strongest first. */
  shared: ScentDim[];
  /** The one dimension that differs most, and in which direction. */
  contrast: { dim: ScentDim; more: boolean } | null;
  families: string[];
  reason: string;
}

function dimSimilarity(user: ScentVector, dna: ScentVector): number {
  let num = 0;
  let den = 0;
  for (const d of SCENT_DIMS) {
    const u = user[d];
    const v = dna[d];
    // Weight by how much this person cares — plus a floor so a fragrance
    // shouting a dimension they never asked for is still scored on it.
    const w = DIM_IMPORTANCE[d] * (0.3 + Math.pow(u / 100, 1.4) * 1.7 + (v > 70 ? 0.4 : 0));
    // Overshoot is worse than shortfall: too sweet is a deal-breaker, slightly
    // less sweet than ideal is merely a different mood.
    const penalty = v > u ? 1.18 : 0.88;
    num += w * Math.max(0, 1 - (Math.abs(u - v) / 100) * penalty);
    den += w;
  }
  return den > 0 ? num / den : 0;
}

function behaviourSimilarity(user: BehaviourVector, frag: BehaviourVector): number {
  let num = 0;
  let den = 0;
  for (const [key, w] of Object.entries(BEHAVIOUR_WEIGHT) as [Behaviour, number][]) {
    num += w * Math.max(0, 1 - Math.abs(user[key] - frag[key]) / 100);
    den += w;
  }
  return den > 0 ? num / den : 0;
}

function occasionFit(occasions: OccasionKey[], frag: BehaviourVector): number {
  if (!occasions.length) return 0.8;
  const fits = occasions.map((o) => {
    const axes = OCCASION_AXES[o];
    const d = (Math.abs(frag.night - axes.night) * 0.6 + Math.abs(frag.formality - axes.formality) * 0.4) / 100;
    return Math.max(0, 1 - d);
  });
  // It only has to suit one of the moments they named, but suiting all of them
  // is better — so the best fit leads and the average keeps it honest.
  return Math.max(...fits) * 0.6 + (fits.reduce((s, x) => s + x, 0) / fits.length) * 0.4;
}

function familyWords(v: ScentVector, count = 3): string[] {
  return rankedDims(v, count).map((r) => FAMILY_WORD[r.dim]);
}

function reasonFor(user: ScentVector, shared: ScentDim[], contrast: ScentMatch["contrast"]): string {
  const liked = shared.slice(0, 2).map((d) => FAMILY_WORD[d].toLowerCase());
  const head =
    liked.length === 2
      ? `Matches your preference for ${liked[0]} ${liked[1]} fragrances`
      : liked.length === 1
        ? `Matches your ${liked[0]} leaning`
        : "Sits close to the centre of your Scentprint";
  if (!contrast) return `${head} almost note for note.`;
  const word = FAMILY_WORD[contrast.dim].toLowerCase();
  const strong = Math.abs(user[contrast.dim] - 50) > 30;
  const degree = strong ? "noticeably" : "slightly";
  return contrast.more
    ? `${head} while adding ${degree} more ${word} character.`
    : `${head} in a cleaner reading that feels ${degree} less ${word}.`;
}

/**
 * Every fragrance on the wearer's shelf scored against a Scentprint, closest
 * first. Filtering happens here rather than at the call sites, so the matches,
 * the Scent Universe and the share card can never disagree about the shelf.
 */
export function matchFragrances(print: Scentprint, frags: Fragrance[], limit?: number): ScentMatch[] {
  const shelf = shelfFor(frags, print.wearer ?? "all");
  const scored = shelf.map((frag): ScentMatch => {
    const dna = fragranceDna(frag);
    const behaviour = fragranceBehaviour(dna);
    const dim = dimSimilarity(print.dims, dna);
    const beh = behaviourSimilarity(print.behaviour, behaviour);
    const occ = occasionFit(print.occasions, behaviour);
    const score = dim * 0.6 + beh * 0.27 + occ * 0.13;

    // Agreement: dimensions both sides hold, ranked by how much they share.
    const shared = SCENT_DIMS.filter((d) => print.dims[d] >= 34 && dna[d] >= 34)
      // Strongest agreement wins a place; the places are then put in reading
      // order, because "fresh woody" is English and "woody fresh" is not.
      .sort((a, b) => Math.min(print.dims[b], dna[b]) - Math.min(print.dims[a], dna[a]))
      .slice(0, 3)
      .sort((a, b) => FAMILY_ORDER.indexOf(a) - FAMILY_ORDER.indexOf(b));
    const gaps = SCENT_DIMS.map((d) => ({ d, gap: dna[d] - print.dims[d] })).filter((x) => Math.abs(x.gap) >= 18);
    gaps.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
    const contrast = gaps.length ? { dim: gaps[0].d, more: gaps[0].gap > 0 } : null;

    return {
      frag,
      dna,
      behaviour,
      score,
      percent: Math.round(Math.min(98, 40 + 62 * Math.pow(score, 1.25))),
      shared,
      contrast,
      families: familyWords(dna),
      reason: reasonFor(print.dims, shared, contrast),
    };
  });
  return scored.sort((a, b) => b.score - a.score || a.frag.name.localeCompare(b.frag.name)).slice(0, limit ?? shelf.length);
}

// ─── Scent Universe™ ─────────────────────────────────────────────────────────

export interface UniverseNode {
  match: ScentMatch;
  /** Radians, 0 = east. Direction the fragrance diverges from you. */
  angle: number;
  /** 0 = you, 1 = the outer edge of the field. */
  radius: number;
  /** 1 closest, 2 adjacent, 3 outer — for the ring bands and labels. */
  ring: 1 | 2 | 3;
  /** Dominant family, used to colour the node. */
  family: ScentDim;
}

/**
 * The wheel every scent is placed on: fresh due north, sweet and amber round to
 * the east, woody due south, floral and clean back up the west side. Neighbours
 * on the wheel are neighbours in the nose, so a map read clockwise reads as a
 * journey rather than a scatter plot.
 */
const WHEEL_ORDER: ScentDim[] = [
  "fresh", "citrus", "fruity", "sweet", "gourmand", "amber", "spicy", "smoky",
  "woody", "aromatic", "green", "powdery", "floral", "musk", "clean", "aquatic",
];

export const WHEEL_ANGLE: Record<ScentDim, number> = Object.fromEntries(
  WHEEL_ORDER.map((d, i) => [d, (i / WHEEL_ORDER.length) * Math.PI * 2 - Math.PI / 2]),
) as Record<ScentDim, number>;

/** The eight families labelled around the edge of the map. */
export const WHEEL_COMPASS: ScentDim[] = ["fresh", "sweet", "amber", "smoky", "woody", "green", "floral", "clean"];

/** A fragrance's bearing: the circular mean of its dimensions, dominant-weighted. */
function wheelAngle(v: ScentVector): number {
  let x = 0;
  let y = 0;
  for (const d of SCENT_DIMS) {
    const w = Math.pow(v[d] / 100, 2.2);
    x += Math.cos(WHEEL_ANGLE[d]) * w;
    y += Math.sin(WHEEL_ANGLE[d]) * w;
  }
  return x === 0 && y === 0 ? -Math.PI / 2 : Math.atan2(y, x);
}

/** Stable per-slug jitter so identical bearings still separate the same way. */
function slugJitter(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) h = (h * 31 + slug.charCodeAt(i)) % 1000;
  return h / 1000 - 0.5;
}

// Nothing sits inside the ring that holds "you" and your family name.
const R_MIN = 0.36;
const R_MAX = 0.97;

/**
 * Places every match around the customer: distance is compatibility, bearing is
 * the fragrance's own scent family. Nothing is allowed to sit on top of anything
 * else, so the field stays readable with the whole house on it.
 */
export function scentUniverse(_print: Scentprint, matches: ScentMatch[]): UniverseNode[] {
  // Distance is compatibility, scaled to this person's own spread: an absolute
  // scale would bunch every scent into one band, since a house that suits you
  // at all suits you within a few points.
  const best = Math.max(...matches.map((m) => m.percent), 1);
  const worst = Math.min(...matches.map((m) => m.percent), best - 1);
  const nodes = matches.map((match): UniverseNode => {
    const closeness = best === worst ? 0.5 : (match.percent - worst) / (best - worst);
    const radius = R_MIN + (R_MAX - R_MIN) * (1 - closeness);
    return {
      match,
      angle: wheelAngle(match.dna) + slugJitter(match.frag.slug) * 0.18,
      radius,
      ring: 1,
      family: rankedDims(match.dna, 1)[0].dim,
    };
  });
  return relax(nodes);
}

/** Pushes overlapping nodes apart — mostly sideways, so the score is preserved. */
function relax(nodes: UniverseNode[]): UniverseNode[] {
  const MIN = 0.125;
  const base = nodes.map((n) => n.radius);
  for (let pass = 0; pass < 80; pass += 1) {
    let moved = false;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const d = Math.hypot(
          Math.cos(a.angle) * a.radius - Math.cos(b.angle) * b.radius,
          Math.sin(a.angle) * a.radius - Math.sin(b.angle) * b.radius,
        );
        if (d >= MIN) continue;
        moved = true;
        const overlap = MIN - d;
        let delta = b.angle - a.angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        const dir = delta === 0 ? 1 : Math.sign(delta);
        a.angle -= (dir * overlap * 0.5) / Math.max(0.3, a.radius);
        b.angle += (dir * overlap * 0.5) / Math.max(0.3, b.radius);
        a.radius = nudge(a.radius - overlap * 0.16, base[i]);
        b.radius = nudge(b.radius + overlap * 0.16, base[j]);
      }
    }
    if (!moved) break;
  }
  for (const n of nodes) n.ring = n.radius < 0.46 ? 1 : n.radius < 0.74 ? 2 : 3;
  return nodes;
}

/** A node may drift a little off its score, never far from it. */
function nudge(value: number, base: number): number {
  return Math.min(Math.min(R_MAX, base + 0.06), Math.max(Math.max(R_MIN, base - 0.06), value));
}

/** House colour for a family — faint cyan for fresh, gold for warm. */
export const FAMILY_COLOUR: Record<ScentDim, string> = {
  fresh: "#5ED6E8",
  citrus: "#8FD98A",
  aquatic: "#00BFFF",
  aromatic: "#7FC9A8",
  green: "#79B36B",
  floral: "#D98CB0",
  fruity: "#E79A73",
  sweet: "#E6C989",
  gourmand: "#C98E5B",
  spicy: "#D9743F",
  woody: "#A8794A",
  amber: "#C9A35B",
  musk: "#B9B6C6",
  smoky: "#8A7D8F",
  powdery: "#CBC3D8",
  clean: "#AFC7D6",
};

// ─── Identity: the words that go with the numbers ────────────────────────────

export interface ScentIdentity {
  primary: string;
  secondary: string;
  character: string[];
  narrative: string;
  /** Strongest dimensions, for the ring (eight to ten reads best). */
  top: { dim: ScentDim; value: number }[];
}

function pairName(dims: ScentDim[]): string {
  const two = dims.slice(0, 2).sort((a, b) => FAMILY_ORDER.indexOf(a) - FAMILY_ORDER.indexOf(b));
  return two.map((d) => FAMILY_WORD[d]).join(" ");
}

/** How a dimension is described when it leads: an adjective, not a field name. */
const LEAD_ADJECTIVE: Record<ScentDim, string> = {
  fresh: "fresh",
  citrus: "bright",
  aquatic: "cool",
  aromatic: "herbal",
  green: "green",
  floral: "floral",
  fruity: "juicy",
  sweet: "sweet",
  gourmand: "warm",
  spicy: "spiced",
  woody: "woody",
  amber: "golden",
  musk: "soft",
  smoky: "smoky",
  powdery: "powdery",
  clean: "clean",
};

/** And how it is described when it sits underneath, giving a scent its body. */
const DEPTH_PHRASE: Record<ScentDim, string> = {
  fresh: "air",
  citrus: "citrus lift",
  aquatic: "sea-cool",
  aromatic: "herbal edge",
  green: "green bite",
  floral: "floral softness",
  fruity: "fruit",
  sweet: "sweetness",
  gourmand: "edible warmth",
  spicy: "spice",
  woody: "woody depth",
  amber: "amber warmth",
  musk: "musk",
  smoky: "smoke",
  powdery: "powder",
  clean: "clean-linen calm",
};

export function identityOf(print: Scentprint): ScentIdentity {
  const ranked = rankedDims(print.dims);
  const b = print.behaviour;
  const character = [
    b.sweetness < 34 ? "Dry" : b.sweetness > 66 ? "Sweet" : "Balanced",
    b.intensity > 66 ? "Intense" : b.intensity < 38 ? "Understated" : "Poised",
    b.formality > 62 ? "Refined" : b.formality < 38 ? "Effortless" : "Versatile",
    b.adventurousness > 62 ? "Unexpected" : b.adventurousness < 38 ? "Timeless" : "Contemporary",
  ];
  if (print.dims.clean > 66) character[0] = "Clean";

  const primary = pairName(ranked.map((r) => r.dim));
  const secondary = pairName(ranked.slice(2).map((r) => r.dim));
  const lead = LEAD_ADJECTIVE[ranked[0].dim];
  const core = DEPTH_PHRASE[ranked[1].dim];
  const accent = DEPTH_PHRASE[ranked[2].dim];
  const weight =
    b.intensity > 66
      ? "You want to be felt in a room, not merely noticed."
      : b.intensity < 38
        ? "You want it close to the skin — found, not announced."
        : "You want presence without volume.";
  const narrative = `You are drawn to fragrances that feel ${lead} and effortless, with enough ${core} depth to give them character without becoming heavy. A thread of ${accent} keeps them from reading plain. ${weight}`;

  return { primary, secondary, character, narrative, top: ranked.slice(0, 10) };
}

// ─── Ring geometry (shared by the SVG ring and the canvas share card) ────────

export interface RingPoint {
  dim: ScentDim;
  value: number;
  angle: number;
  /** Unit position at the value's radius, centre-relative. */
  x: number;
  y: number;
  /** Unit position on the outer edge, for spokes and labels. */
  ex: number;
  ey: number;
}

/**
 * Positions for a radar ring: twelve o'clock first, clockwise. `floor` keeps a
 * near-zero dimension off the exact centre so the shape stays a shape.
 */
export function ringPoints(dims: { dim: ScentDim; value: number }[], floor = 0.14): RingPoint[] {
  const n = Math.max(3, dims.length);
  return dims.map((d, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = floor + (1 - floor) * (clamp(d.value) / 100);
    return {
      dim: d.dim,
      value: d.value,
      angle,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      ex: Math.cos(angle),
      ey: Math.sin(angle),
    };
  });
}

/** Closed SVG path (or canvas point list) for a ring at a given pixel radius. */
export function ringPath(points: RingPoint[], cx: number, cy: number, radius: number): string {
  if (!points.length) return "";
  return `${points.map((p, i) => `${i === 0 ? "M" : "L"}${(cx + p.x * radius).toFixed(2)},${(cy + p.y * radius).toFixed(2)}`).join(" ")} Z`;
}

// ─── Share codes ─────────────────────────────────────────────────────────────
//
// A Scentprint encodes to a short, opaque string of numbers only — no name, no
// email, nothing about the person. Crockford base32 (no I/L/O/U) so a code read
// off a QR or a phone screen can't be mistyped into someone else's result.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function enc5(value: number): string {
  return ALPHABET[Math.round((clamp(value) / 100) * 31)];
}
function dec5(ch: string): number {
  const i = ALPHABET.indexOf(ch.toUpperCase());
  return i < 0 ? 0 : Math.round((i / 31) * 100);
}

const WEARER_CODE: Record<Wearer, string> = { him: "H", her: "F", all: "A" };

/** Self-contained code: the whole Scentprint travels in the link. */
export function encodeScentprint(p: Scentprint): string {
  const dims = SCENT_DIMS.map((d) => enc5(p.dims[d])).join("");
  const beh = BEHAVIOURS.map((b) => enc5(p.behaviour[b])).join("");
  const mask = OCCASIONS.reduce((m, o, i) => (p.occasions.includes(o) ? m | (1 << i) : m), 0);
  return `2${dims}${beh}${ALPHABET[mask & 31]}${ALPHABET[(mask >> 5) & 31]}${WEARER_CODE[p.wearer ?? "all"]}`;
}

// Version 1 codes predate the wearer question and open on the whole house;
// version 2 carries it as a trailing character.
const V1_LENGTH = 1 + SCENT_DIMS.length + BEHAVIOURS.length + 2;
const V2_LENGTH = V1_LENGTH + 1;

/** True when the code carries its own payload (as opposed to a stored id). */
export function isEncodedCode(code: string): boolean {
  return (code.length === V2_LENGTH && code[0] === "2") || (code.length === V1_LENGTH && code[0] === "1");
}

export function decodeScentprint(code: string): Scentprint | null {
  const c = code.trim().toUpperCase();
  if (!isEncodedCode(c)) return null;
  const dims = zeroVector();
  SCENT_DIMS.forEach((d, i) => {
    dims[d] = dec5(c[1 + i]);
  });
  const behaviour = {} as BehaviourVector;
  BEHAVIOURS.forEach((b, i) => {
    behaviour[b] = dec5(c[1 + SCENT_DIMS.length + i]);
  });
  const v2 = c[0] === "2";
  const maskAt = 1 + SCENT_DIMS.length + BEHAVIOURS.length;
  const maskLow = ALPHABET.indexOf(c[maskAt]);
  const maskHigh = ALPHABET.indexOf(c[maskAt + 1]);
  const mask = (maskLow < 0 ? 0 : maskLow) | ((maskHigh < 0 ? 0 : maskHigh) << 5);
  const wearerChar = v2 ? c[maskAt + 2] : "A";
  return {
    version: 1,
    dims,
    behaviour,
    occasions: OCCASIONS.filter((_, i) => (mask & (1 << i)) !== 0),
    wearer: (Object.keys(WEARER_CODE) as Wearer[]).find((w) => WEARER_CODE[w] === wearerChar) ?? "all",
    createdAt: new Date().toISOString(),
  };
}

/** Rebuilds a Scentprint from a stored row, tolerating a partial payload. */
export function scentprintFrom(
  dims: Partial<ScentVector>,
  behaviour?: Partial<BehaviourVector>,
  occasions?: string[],
  loves?: string | null,
  wearer?: string | null,
): Scentprint {
  const v = zeroVector();
  for (const d of SCENT_DIMS) v[d] = clamp(Math.round(Number(dims[d] ?? 0)));
  const derived = fragranceBehaviour(v);
  const b = {} as BehaviourVector;
  for (const key of BEHAVIOURS) {
    const raw = behaviour?.[key];
    b[key] = raw == null || Number.isNaN(Number(raw)) ? derived[key] : clamp(Math.round(Number(raw)));
  }
  return {
    version: 1,
    dims: v,
    behaviour: b,
    occasions: OCCASIONS.filter((o) => (occasions ?? []).includes(o)),
    wearer: wearer === "him" || wearer === "her" ? wearer : "all",
    loves: loves ?? null,
    createdAt: new Date().toISOString(),
  };
}
