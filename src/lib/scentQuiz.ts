// ─── The discovery experience: twelve visual questions → one Scentprint ──────
//
// Deliberately not a questionnaire. Each question is a scene, a material or a
// single slider; each answer carries weighted contributions to the sixteen
// scent dimensions and, where it says something behavioural, a target value on
// one of the behavioural axes. Nothing here knows about the catalogue except
// the optional "a fragrance you already love", which blends the closest house
// scent's own Scentprint into the result.

import type { Fragrance } from "./data";
import { findMatches } from "./formats";
import {
  BEHAVIOURS,
  OCCASIONS,
  SCENT_DIMS,
  clamp,
  fragranceBehaviour,
  fragranceDna,
  type Behaviour,
  type BehaviourVector,
  type OccasionKey,
  type Scentprint,
  type ScentVector,
  zeroVector,
} from "./scentdna";

export type GlyphName =
  | "wave" | "rain" | "arch" | "tumbler"
  | "frost" | "ember" | "eclipse" | "sunburst"
  | "rose" | "fern" | "blossom" | "cedar"
  | "shirt" | "suit" | "linen" | "leather"
  | "obsidian" | "seaglass" | "suede" | "timber"
  | "espresso" | "cacao" | "sorbet" | "honey"
  | "dawn" | "dusk" | "night";

export interface ChoiceOption {
  id: string;
  label: string;
  /** One line of atmosphere under the label — never instructions. */
  note: string;
  glyph: GlyphName;
  /** Two stops for the card's smoked-glass wash. */
  tone: [string, string];
  dna: Partial<ScentVector>;
  behaviour?: Partial<BehaviourVector>;
}

interface BaseQuestion {
  id: string;
  eyebrow: string;
  prompt: string;
  help?: string;
  /** How much this question counts toward the scent vector. */
  weight?: number;
}

export interface ChoiceQuestion extends BaseQuestion {
  kind: "choice";
  columns?: 2 | 3 | 4;
  options: ChoiceOption[];
}
export interface MultiQuestion extends BaseQuestion {
  kind: "multi";
  options: { id: OccasionKey; label: string; note: string }[];
}
export interface SliderQuestion extends BaseQuestion {
  kind: "slider";
  axis: Behaviour;
  poles: [string, string, string];
  initial: number;
}
export interface LovedQuestion extends BaseQuestion {
  kind: "loved";
}

export type Question = ChoiceQuestion | MultiQuestion | SliderQuestion | LovedQuestion;

export const QUESTIONS: Question[] = [
  {
    kind: "choice",
    id: "environment",
    eyebrow: "Environment",
    prompt: "Where would you rather escape to?",
    weight: 1.2,
    columns: 4,
    options: [
      {
        id: "coast",
        label: "Mediterranean coast",
        note: "Salt air, citrus groves, white stone",
        glyph: "wave",
        tone: ["#0F1E3D", "#00BFFF"],
        dna: { citrus: 1, aquatic: 0.9, fresh: 1, green: 0.3, clean: 0.5 },
        behaviour: { night: 24, formality: 26 },
      },
      {
        id: "forest",
        label: "Rain-soaked forest",
        note: "Wet moss, resin, cold bark",
        glyph: "rain",
        tone: ["#101820", "#3E6B52"],
        dna: { green: 1, woody: 0.9, aromatic: 0.8, fresh: 0.6, smoky: 0.2 },
        behaviour: { night: 42, formality: 42 },
      },
      {
        id: "hotel",
        label: "Luxury hotel",
        note: "Pressed linen, lobby marble, iris",
        glyph: "arch",
        tone: ["#101820", "#C9A35B"],
        dna: { clean: 0.9, musk: 0.8, powdery: 0.7, floral: 0.5, woody: 0.4, amber: 0.3 },
        behaviour: { formality: 80, night: 50 },
      },
      {
        id: "bar",
        label: "Dark cocktail bar",
        note: "Smoke, leather banquette, rum",
        glyph: "tumbler",
        tone: ["#080B0F", "#7A4B2A"],
        dna: { smoky: 0.9, amber: 0.8, spicy: 0.7, woody: 0.6, gourmand: 0.5, sweet: 0.4 },
        behaviour: { night: 88, formality: 62, intensity: 74 },
      },
    ],
  },
  {
    kind: "choice",
    id: "atmosphere",
    eyebrow: "Temperature",
    prompt: "Which atmosphere feels most like you?",
    columns: 4,
    options: [
      {
        id: "crisp",
        label: "Crisp and cool",
        note: "Air off water, early and clear",
        glyph: "frost",
        tone: ["#0F1E3D", "#9FD8EC"],
        dna: { fresh: 1, aquatic: 0.7, citrus: 0.6, green: 0.4, clean: 0.6 },
        behaviour: { intensity: 40 },
      },
      {
        id: "warm",
        label: "Warm and comforting",
        note: "Skin, amber, low light",
        glyph: "ember",
        tone: ["#101820", "#C9A35B"],
        dna: { amber: 0.9, sweet: 0.8, gourmand: 0.6, musk: 0.5, powdery: 0.4 },
        behaviour: { sweetness: 66 },
      },
      {
        id: "dark",
        label: "Dark and intense",
        note: "Resin, smoke, something held back",
        glyph: "eclipse",
        tone: ["#080B0F", "#4A3A55"],
        dna: { smoky: 1, woody: 0.7, spicy: 0.6, amber: 0.6 },
        behaviour: { intensity: 84, night: 84 },
      },
      {
        id: "bright",
        label: "Bright and energetic",
        note: "Zest, movement, open windows",
        glyph: "sunburst",
        tone: ["#101820", "#E6C989"],
        dna: { citrus: 1, fruity: 0.8, fresh: 0.9, green: 0.4 },
        behaviour: { night: 22, intensity: 48 },
      },
    ],
  },
  {
    kind: "choice",
    id: "garden",
    eyebrow: "Nature",
    prompt: "Which garden would you walk through at dusk?",
    columns: 4,
    options: [
      {
        id: "rose",
        label: "Rose and iris",
        note: "Velvet petals, cool powder",
        glyph: "rose",
        tone: ["#101820", "#B06A8C"],
        dna: { floral: 1, powdery: 0.8, musk: 0.4 },
      },
      {
        id: "fern",
        label: "Moss and ferns",
        note: "Damp green, stone, shade",
        glyph: "fern",
        tone: ["#101820", "#4C8A5E"],
        dna: { green: 1, aromatic: 0.7, woody: 0.5, aquatic: 0.3 },
      },
      {
        id: "blossom",
        label: "Orange blossom",
        note: "White petals, honeyed air",
        glyph: "blossom",
        tone: ["#101820", "#E6C989"],
        dna: { floral: 0.9, citrus: 0.6, clean: 0.5, sweet: 0.3 },
      },
      {
        id: "cedar",
        label: "Cedar and pine",
        note: "Dry timber, cold needles",
        glyph: "cedar",
        tone: ["#101820", "#8A6A3F"],
        dna: { woody: 1, aromatic: 0.7, green: 0.4, smoky: 0.3 },
      },
    ],
  },
  {
    kind: "choice",
    id: "style",
    eyebrow: "Style",
    prompt: "Which feels closer to your personal style?",
    weight: 1.1,
    columns: 4,
    options: [
      {
        id: "shirt",
        label: "Crisp white shirt",
        note: "Nothing extra. Nothing missing.",
        glyph: "shirt",
        tone: ["#101820", "#AFC7D6"],
        dna: { clean: 1, musk: 0.7, citrus: 0.5, fresh: 0.6 },
        behaviour: { formality: 60 },
      },
      {
        id: "suit",
        label: "Tailored black suit",
        note: "Precision, weight, restraint",
        glyph: "suit",
        tone: ["#080B0F", "#C9A35B"],
        dna: { woody: 0.9, amber: 0.6, smoky: 0.5, powdery: 0.4 },
        behaviour: { formality: 88, night: 64 },
      },
      {
        id: "linen",
        label: "Relaxed linen",
        note: "Unhurried, sun-warmed, easy",
        glyph: "linen",
        tone: ["#101820", "#D8CBA8" ],
        dna: { fresh: 0.9, aquatic: 0.6, citrus: 0.6, green: 0.4, musk: 0.4 },
        behaviour: { formality: 18, night: 26 },
      },
      {
        id: "leather",
        label: "Leather jacket",
        note: "Worn in, a little dangerous",
        glyph: "leather",
        tone: ["#080B0F", "#8A5A3A"],
        dna: { smoky: 1, woody: 0.6, spicy: 0.5, amber: 0.4 },
        behaviour: { formality: 30, adventurousness: 72 },
      },
    ],
  },
  {
    kind: "choice",
    id: "material",
    eyebrow: "Material",
    prompt: "Which surface would you rather hold?",
    columns: 4,
    options: [
      {
        id: "obsidian",
        label: "Polished obsidian",
        note: "Cold, black, mirror-bright",
        glyph: "obsidian",
        tone: ["#080B0F", "#2B3A4A"],
        dna: { smoky: 0.7, woody: 0.6, musk: 0.5, amber: 0.4 },
        behaviour: { intensity: 70 },
      },
      {
        id: "seaglass",
        label: "Sea glass",
        note: "Tumbled, translucent, cool",
        glyph: "seaglass",
        tone: ["#0F1E3D", "#00BFFF"],
        dna: { aquatic: 1, fresh: 0.8, clean: 0.6, citrus: 0.4 },
      },
      {
        id: "suede",
        label: "Worn suede",
        note: "Soft nap, warm, close",
        glyph: "suede",
        tone: ["#101820", "#A87C55"],
        dna: { smoky: 0.8, powdery: 0.5, musk: 0.5, amber: 0.5 },
      },
      {
        id: "timber",
        label: "Cut timber",
        note: "Sawdust, sap, open grain",
        glyph: "timber",
        tone: ["#101820", "#8A6A3F"],
        dna: { woody: 1, aromatic: 0.6, green: 0.4, spicy: 0.3 },
      },
    ],
  },
  {
    kind: "choice",
    id: "indulgence",
    eyebrow: "Appetite",
    prompt: "Late at night, which do you reach for?",
    columns: 4,
    options: [
      {
        id: "espresso",
        label: "Espresso, no sugar",
        note: "Bitter, dark, awake",
        glyph: "espresso",
        tone: ["#080B0F", "#6B4A2B"],
        dna: { gourmand: 0.8, smoky: 0.5, spicy: 0.3, sweet: 0.2 },
        behaviour: { sweetness: 34 },
      },
      {
        id: "cacao",
        label: "Dark chocolate and salt",
        note: "Rich, edged, grown-up",
        glyph: "cacao",
        tone: ["#101820", "#7A4B2A"],
        dna: { gourmand: 1, sweet: 0.7, amber: 0.5, smoky: 0.3 },
        behaviour: { sweetness: 62 },
      },
      {
        id: "sorbet",
        label: "Citrus sorbet",
        note: "Sharp, cold, clean finish",
        glyph: "sorbet",
        tone: ["#0F1E3D", "#8FD98A"],
        dna: { citrus: 1, fruity: 0.8, fresh: 0.8 },
        behaviour: { sweetness: 40 },
      },
      {
        id: "honey",
        label: "Honeyed pastry",
        note: "Warm, buttery, indulgent",
        glyph: "honey",
        tone: ["#101820", "#E6C989"],
        dna: { sweet: 1, gourmand: 0.9, amber: 0.6, powdery: 0.3 },
        behaviour: { sweetness: 84 },
      },
    ],
  },
  {
    kind: "choice",
    id: "moment",
    eyebrow: "Moment",
    prompt: "When does your fragrance matter most?",
    columns: 3,
    options: [
      {
        id: "dawn",
        label: "First light",
        note: "Before the day asks anything",
        glyph: "dawn",
        tone: ["#0F1E3D", "#9FD8EC"],
        dna: { fresh: 0.8, citrus: 0.7, clean: 0.6, green: 0.3 },
        behaviour: { night: 12 },
      },
      {
        id: "golden",
        label: "Golden hour",
        note: "The long, warm middle",
        glyph: "dusk",
        tone: ["#101820", "#E6C989"],
        dna: { amber: 0.5, floral: 0.5, woody: 0.5, fruity: 0.4, musk: 0.4 },
        behaviour: { night: 48 },
      },
      {
        id: "night",
        label: "After dark",
        note: "When the room goes quiet",
        glyph: "night",
        tone: ["#080B0F", "#4A3A55"],
        dna: { amber: 0.7, smoky: 0.7, spicy: 0.5, sweet: 0.4 },
        behaviour: { night: 90, intensity: 70 },
      },
    ],
  },
  {
    kind: "slider",
    id: "projection",
    axis: "projection",
    eyebrow: "Scent behaviour",
    prompt: "How noticeable should your fragrance be?",
    help: "Drag to set how far it travels.",
    poles: ["Personal", "Noticeable", "Commanding"],
    initial: 50,
  },
  {
    kind: "slider",
    id: "sweetness",
    axis: "sweetness",
    eyebrow: "Sweetness",
    prompt: "Dry, or sweet?",
    help: "Most people sit somewhere in between.",
    poles: ["Dry", "Balanced", "Sweet"],
    initial: 46,
  },
  {
    kind: "slider",
    id: "adventurousness",
    axis: "adventurousness",
    eyebrow: "Familiarity",
    prompt: "Should your fragrance feel familiar, or unexpected?",
    poles: ["Familiar", "Distinctive", "Adventurous"],
    initial: 50,
  },
  {
    kind: "multi",
    id: "occasions",
    eyebrow: "Occasion",
    prompt: "When will you wear it?",
    help: "Choose as many as you like.",
    options: OCCASIONS.map((id) => ({
      id,
      label:
        id === "everyday" ? "Everyday" : id === "work" ? "Work" : id === "weekend" ? "Weekend" : id === "date" ? "Date Night" : id === "evening" ? "Evening" : "Special Occasion",
      note:
        id === "everyday"
          ? "Skin scent, every morning"
          : id === "work"
            ? "Close, considered, no debate"
            : id === "weekend"
              ? "Unhurried and open-air"
              : id === "date"
                ? "Warm, worn close"
                : id === "evening"
                  ? "Rooms, not corridors"
                  : "Weddings, openings, milestones",
    })),
  },
  {
    kind: "loved",
    id: "loved",
    eyebrow: "Existing fragrance",
    prompt: "Is there already a fragrance you love?",
    help: "Optional. It sharpens your Scentprint — skip it if nothing comes to mind.",
  },
];

// ─── Answers ─────────────────────────────────────────────────────────────────

export interface QuizAnswers {
  /** question id → option id (choice questions). */
  choices: Record<string, string>;
  /** question id → 0–100 (sliders). */
  sliders: Record<string, number>;
  occasions: OccasionKey[];
  loved: string;
}

export function emptyAnswers(): QuizAnswers {
  const sliders: Record<string, number> = {};
  for (const q of QUESTIONS) if (q.kind === "slider") sliders[q.id] = q.initial;
  return { choices: {}, sliders, occasions: [], loved: "" };
}

/** A question counts as answered once it can't block the reveal. */
export function isAnswered(q: Question, a: QuizAnswers): boolean {
  switch (q.kind) {
    case "choice":
      return !!a.choices[q.id];
    case "multi":
      return a.occasions.length > 0;
    case "slider":
    case "loved":
      return true;
  }
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function normaliseQuiz(acc: ScentVector): ScentVector {
  const max = Math.max(...SCENT_DIMS.map((d) => acc[d]));
  const out = zeroVector();
  if (max <= 0) return out;
  for (const d of SCENT_DIMS) {
    if (acc[d] <= 0) continue;
    // Same shaping as a fragrance's own print, so the two are comparable.
    out[d] = clamp(Math.max(5, Math.round(92 * Math.pow(acc[d] / max, 0.8))));
  }
  return out;
}

/** Sliders pull the vector as well as the behavioural axes. */
function applySliders(acc: ScentVector, a: QuizAnswers): void {
  const sweet = (a.sliders.sweetness ?? 50) / 100;
  const loud = (a.sliders.projection ?? 50) / 100;
  const bold = (a.sliders.adventurousness ?? 50) / 100;

  acc.sweet += sweet * 1.5;
  acc.gourmand += Math.max(0, sweet - 0.35) * 1.4;
  acc.amber += sweet * 0.7;
  // A dry preference is an active one: it asks for citrus, herbs and wood.
  acc.citrus += Math.max(0, 0.55 - sweet) * 1.4;
  acc.aromatic += Math.max(0, 0.55 - sweet) * 1.3;
  acc.woody += Math.max(0, 0.55 - sweet) * 0.9;

  acc.amber += loud * 0.6;
  acc.smoky += Math.max(0, loud - 0.5) * 1.2;
  acc.musk += Math.max(0, 0.6 - loud) * 0.9;
  acc.clean += Math.max(0, 0.6 - loud) * 0.8;

  acc.smoky += Math.max(0, bold - 0.5) * 1.3;
  acc.spicy += Math.max(0, bold - 0.4) * 1.0;
  acc.green += Math.max(0, bold - 0.55) * 0.7;
  acc.clean += Math.max(0, 0.55 - bold) * 1.2;
  acc.fresh += Math.max(0, 0.55 - bold) * 0.9;
  acc.musk += Math.max(0, 0.55 - bold) * 0.7;
}

const OCCASION_AXIS_HINT: Record<OccasionKey, { night: number; formality: number }> = {
  everyday: { night: 28, formality: 32 },
  work: { night: 20, formality: 76 },
  weekend: { night: 34, formality: 14 },
  date: { night: 80, formality: 58 },
  evening: { night: 92, formality: 54 },
  special: { night: 74, formality: 90 },
};

/**
 * The whole experience in one number set. `fragrances` is optional and only
 * used to read the "a fragrance you already love" answer: the closest house
 * scent's own Scentprint is blended in at a fifth of the weight, which is also
 * the hook for reading real designer references once we hold that data.
 */
export function computeScentprint(a: QuizAnswers, fragrances: Fragrance[] = []): Scentprint {
  const acc = zeroVector();
  const behTargets: Partial<Record<Behaviour, number[]>> = {};

  for (const q of QUESTIONS) {
    if (q.kind !== "choice") continue;
    const chosen = q.options.find((o) => o.id === a.choices[q.id]);
    if (!chosen) continue;
    const w = q.weight ?? 1;
    for (const d of SCENT_DIMS) {
      const v = chosen.dna[d];
      // Curved, not linear: a dimension mentioned faintly by six answers
      // shouldn't outrank one a single answer shouts.
      if (v) acc[d] += Math.pow(v, 1.35) * w;
    }
    for (const key of BEHAVIOURS) {
      const v = chosen.behaviour?.[key];
      if (v == null) continue;
      (behTargets[key] ??= []).push(v);
    }
  }
  applySliders(acc, a);

  let dims = normaliseQuiz(acc);

  // A fragrance they already love is the strongest single signal we get.
  const loved = a.loved.trim();
  let lovedMatch: Fragrance | null = null;
  if (loved.length >= 3 && fragrances.length) {
    lovedMatch = findMatches(loved, fragrances, 1)[0]?.frag ?? null;
    if (lovedMatch) {
      const theirs = fragranceDna(lovedMatch);
      const blended = zeroVector();
      for (const d of SCENT_DIMS) blended[d] = Math.round(dims[d] * 0.8 + theirs[d] * 0.2);
      dims = blended;
    }
  }

  // Behaviour: what the numbers imply, corrected by what they told us.
  const derived = fragranceBehaviour(dims);
  const behaviour = { ...derived };
  for (const key of BEHAVIOURS) {
    const targets = behTargets[key];
    if (!targets?.length) continue;
    const mean = targets.reduce((s, x) => s + x, 0) / targets.length;
    behaviour[key] = clamp(Math.round(derived[key] * 0.45 + mean * 0.55));
  }

  const occasions = a.occasions.slice();
  if (occasions.length) {
    const night = occasions.reduce((s, o) => s + OCCASION_AXIS_HINT[o].night, 0) / occasions.length;
    const formality = occasions.reduce((s, o) => s + OCCASION_AXIS_HINT[o].formality, 0) / occasions.length;
    behaviour.night = clamp(Math.round(behaviour.night * 0.5 + night * 0.5));
    behaviour.formality = clamp(Math.round(behaviour.formality * 0.5 + formality * 0.5));
  }

  // The three sliders are stated preferences: they win outright.
  behaviour.projection = clamp(Math.round(a.sliders.projection ?? behaviour.projection));
  behaviour.sweetness = clamp(Math.round(a.sliders.sweetness ?? behaviour.sweetness));
  behaviour.adventurousness = clamp(Math.round(a.sliders.adventurousness ?? behaviour.adventurousness));
  behaviour.familiarity = clamp(100 - behaviour.adventurousness);
  behaviour.intensity = clamp(Math.round(behaviour.intensity * 0.45 + behaviour.projection * 0.55));
  behaviour.longevity = clamp(Math.round(behaviour.longevity * 0.5 + (40 + behaviour.projection * 0.5) * 0.5));

  return {
    version: 1,
    dims,
    behaviour,
    occasions,
    loves: lovedMatch ? loved : loved || null,
    createdAt: new Date().toISOString(),
  };
}

/** Suggestions for the "fragrance you love" field — house names and references. */
export function lovedSuggestions(query: string, fragrances: Fragrance[], limit = 5): { label: string; sub: string }[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const seen = new Set<string>();
  const out: { label: string; sub: string }[] = [];
  for (const m of findMatches(q, fragrances, limit + 3)) {
    const ref = m.frag.inspiration.replace(/^inspired by\s*/i, "").replace(/\s*[-–—]\s*/, " ");
    const label = ref || m.frag.name;
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push({ label, sub: `Closest in the house · ${m.frag.name}` });
    if (out.length >= limit) break;
  }
  return out;
}
