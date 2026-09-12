// ─── The Scent DNA AI layer, client side ─────────────────────────────────────
//
// Six capabilities, one endpoint (api/scent-ai.ts), and a local fallback for
// every one of them. The house rule from the rest of the app holds here: with
// no ANTHROPIC_API_KEY the route answers 501 and the experience keeps working —
// worse prose, same mechanics — because the Scentprint, the scores and the
// universe are all computed here, not by the model.
//
// What the model is and isn't for:
//   • it never scores a match — matchFragrances() does that, and the model is
//     handed the result to put into words
//   • it never writes a Scentprint straight into storage — everything it
//     proposes goes through scentprintFrom()/clamps in scentdna.ts
//   • it is the only thing here that reads a photograph or a sentence of
//     feedback, because nothing deterministic can

import type { Fragrance } from "./data";
import { fromLabel, referenceOf } from "./formats";
import {
  BEHAVIOURS,
  DIM_SHORT,
  OCCASION_LABEL,
  SCENT_DIMS,
  clamp,
  fragranceDna,
  matchFragrances,
  rankedDims,
  scentprintFrom,
  textToDna,
  zeroVector,
  type Behaviour,
  type ScentDim,
  type ScentMatch,
  type Scentprint,
  type ScentVector,
} from "./scentdna";

const ENDPOINT = "/api/scent-ai";

/** True once a call has come back 501 — stops the UI offering AI it can't run. */
let unconfigured = false;
export function scentAiAvailable(): boolean {
  return !unconfigured;
}

/**
 * Success and failure carry each other's fields as `undefined` rather than
 * omitting them. Callers can read `res.error` or `res.result` straight off the
 * union without narrowing first, which is worth more here than the tighter
 * shape — every one of these is consumed in a React handler.
 */
export type AiResult<T> =
  | {
      ok: true;
      result: T;
      /** False when the answer came from the local fallback rather than the model. */
      ai: boolean;
      error?: undefined;
      retryAfter?: undefined;
    }
  | { ok: false; error: string; retryAfter?: number; result?: undefined; ai?: undefined };

/** The failure half, for relaying one operation's error out of another. */
export type AiFailure = Extract<AiResult<unknown>, { ok: false }>;

async function call<T>(op: string, payload: Record<string, unknown>): Promise<AiResult<T> | null> {
  if (unconfigured) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op, ...payload }),
    });
    // 501 is "no API key"; 404/405 is the route not being there at all, which
    // is what the Vite dev server and any partial deployment look like. Both
    // mean the same thing to a caller: use the local fallback.
    if (res.status === 501 || res.status === 404 || res.status === 405) {
      unconfigured = true;
      return null;
    }
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: "Too many requests — give it a moment.", retryAfter: Number(body?.retryAfter) || 20 };
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: typeof body?.error === "string" ? body.error : `Request failed (${res.status})` };
    }
    const body = (await res.json()) as { result: T };
    return { ok: true, result: body.result, ai: true };
  } catch {
    return null; // network trouble is treated like "not configured": fall back
  }
}

/**
 * A failure carries no result, so it can be relayed to a caller expecting a
 * differently-shaped one. Keeps every operation's error path to a single line.
 */
function isFailure(res: AiResult<unknown> | null): res is AiFailure {
  return res !== null && res.ok === false;
}

// ─── The shared catalogue context ────────────────────────────────────────────

/**
 * The catalogue as the model reads it: one line per scent, with the numbers our
 * own engine derived. Deterministic — same catalogue in, same bytes out — which
 * is what lets the server cache it as a prompt prefix instead of re-reading it
 * on every call.
 */
export function catalogueContext(fragrances: Fragrance[]): string {
  return fragrances
    .map((f) => {
      const dna = fragranceDna(f);
      const top = rankedDims(dna, 4)
        .filter((d) => d.value > 0)
        .map((d) => `${DIM_SHORT[d.dim]} ${d.value}`)
        .join(", ");
      const ref = referenceOf(f);
      const notes = [...f.top, ...f.heart, ...f.base].slice(0, 8).join(", ");
      return [
        f.slug,
        f.name,
        `for ${f.gender === "masculine" ? "him" : f.gender === "feminine" ? "her" : "anyone"}`,
        `like ${ref.brand}${ref.fragrance ? ` ${ref.fragrance}` : ""}`,
        top,
        notes,
        fromLabel(f),
      ].join(" | ");
    })
    .join("\n");
}

/** A Scentprint in the shape the prompts describe. */
function printPayload(print: Scentprint) {
  return {
    dims: print.dims,
    behaviour: print.behaviour,
    occasions: print.occasions.map((o) => OCCASION_LABEL[o]),
    wearer: print.wearer ?? "all",
  };
}

/** Turns whatever the model returned into a Scentprint the engine trusts. */
function toScentprint(raw: unknown, base?: Scentprint): Scentprint {
  const r = (raw ?? {}) as { dims?: Record<string, number>; behaviour?: Record<string, number> };
  const print = scentprintFrom(r.dims ?? {}, r.behaviour, base?.occasions, base?.loves, base?.wearer);
  return { ...print, wearer: base?.wearer ?? print.wearer, occasions: base?.occasions ?? print.occasions };
}

// ─── F1 · Conversational Scent Discovery ─────────────────────────────────────

export interface ConverseTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ConverseReply {
  reply: string;
  ready: boolean;
  confidence: number;
  /** The print as it stands — shown filling in while they talk. */
  print: Scentprint;
  reading?: string;
}

/**
 * One turn of the discovery conversation. Returns the reply plus the running
 * Scentprint, so the ring on screen fills in as the conversation goes rather
 * than appearing at the end.
 */
export async function converse(
  messages: ConverseTurn[],
  fragrances: Fragrance[],
  base?: Scentprint,
): Promise<AiResult<ConverseReply>> {
  const res = await call<{ reply: string; ready: boolean; confidence: number; dims: Record<string, number>; behaviour?: Record<string, number>; reading?: string }>(
    "converse",
    { messages, catalogue: catalogueContext(fragrances), print: base ? printPayload(base) : undefined },
  );
  if (isFailure(res)) return res;
  if (res?.ok) {
    return {
      ok: true,
      ai: true,
      result: {
        reply: res.result.reply,
        ready: !!res.result.ready,
        confidence: clamp(Math.round(res.result.confidence ?? 0)),
        print: toScentprint(res.result, base),
        reading: res.result.reading,
      },
    };
  }
  return { ok: true, ai: false, result: scriptedConverse(messages, base) };
}

/**
 * The conversation without a model: a fixed ladder of plain-language questions,
 * with the lexicon reading whatever they type. Fewer follow-ups and no warmth,
 * but it reaches a real Scentprint.
 */
const SCRIPT: { ask: string; reading: string }[] = [
  { ask: "Let's start somewhere easy — where would you rather wake up: somewhere by the sea, deep in a forest, or a hotel in a city?", reading: "where you'd rather be" },
  { ask: "What's the weather like in your favourite kind of day?", reading: "the air you like" },
  { ask: "Think of something you love the smell of that isn't perfume — food, a place, a material. What is it?", reading: "what you already love" },
  { ask: "When do you most want to smell like yourself — first thing, through the working day, or after dark?", reading: "when it matters" },
  { ask: "Last one: should people notice it from across a room, or only when they're close?", reading: "how far it travels" },
];

function scriptedConverse(messages: ConverseTurn[], base?: Scentprint): ConverseReply {
  const answers = messages.filter((m) => m.role === "user");
  const said = answers.map((m) => m.content).join(" ");
  const step = answers.length;
  const dna = textToDna(said);
  const anySignal = SCENT_DIMS.some((d) => dna[d] > 0);
  const dims = anySignal ? dna : (base?.dims ?? zeroVector());

  // Late in the ladder, lean the behavioural read on the words they used.
  const behaviour = scentprintFrom(dims).behaviour;
  if (/\b(close|subtle|quiet|only when|intimate|personal)\b/i.test(said)) behaviour.projection = clamp(behaviour.projection - 22);
  if (/\b(across a room|notice|bold|statement|strong)\b/i.test(said)) behaviour.projection = clamp(behaviour.projection + 22);
  if (/\b(evening|night|after dark|dinner)\b/i.test(said)) behaviour.night = clamp(behaviour.night + 25);
  if (/\b(morning|first thing|daytime|work)\b/i.test(said)) behaviour.night = clamp(behaviour.night - 25);

  const ready = step >= SCRIPT.length;
  return {
    reply: ready
      ? "That's enough to draw it. Building your Scent DNA now."
      : SCRIPT[Math.min(step, SCRIPT.length - 1)].ask,
    ready,
    confidence: Math.min(95, step * 19),
    print: { ...scentprintFrom(dims, behaviour, base?.occasions, base?.loves, base?.wearer) },
    reading: step > 0 ? SCRIPT[Math.min(step - 1, SCRIPT.length - 1)].reading : undefined,
  };
}

// ─── F5 · Memory / image → Scentprint ────────────────────────────────────────

export interface ImaginedScent {
  print: Scentprint;
  title: string;
  story: string;
  cues: string[];
}

export async function imagine(
  input: { memory?: string; image?: { data: string; mediaType: string } },
  fragrances: Fragrance[],
  base?: Scentprint,
): Promise<AiResult<ImaginedScent>> {
  const res = await call<{ dims: Record<string, number>; behaviour?: Record<string, number>; title: string; story: string; cues?: string[] }>(
    "imagine",
    { memory: input.memory, image: input.image, catalogue: catalogueContext(fragrances) },
  );
  if (isFailure(res)) return res;
  if (res?.ok) {
    return {
      ok: true,
      ai: true,
      result: {
        print: toScentprint(res.result, base),
        title: res.result.title,
        story: res.result.story,
        cues: (res.result.cues ?? []).slice(0, 6),
      },
    };
  }

  // Without a model there is no reading a photograph — but a description still
  // goes through the same lexicon the catalogue is read with.
  const memory = (input.memory ?? "").trim();
  const dna = textToDna(memory);
  if (!memory || !SCENT_DIMS.some((d) => dna[d] > 0)) {
    return {
      ok: false,
      error: input.image
        ? "Reading photographs needs the concierge, which isn't switched on here. Describe the moment in words instead."
        : "Tell me a little more — where you were, the weather, what was around you.",
    };
  }
  const print = scentprintFrom(dna, undefined, base?.occasions, base?.loves, base?.wearer);
  const top = rankedDims(print.dims, 2).map((d) => DIM_SHORT[d.dim]);
  return {
    ok: true,
    ai: false,
    result: {
      print,
      title: top.join(" & "),
      story: `Read from what you described: mostly ${top[0]?.toLowerCase() ?? "fresh"}, with ${top[1]?.toLowerCase() ?? "clean"} underneath.`,
      cues: [],
    },
  };
}

// ─── F3 · Match explanation ──────────────────────────────────────────────────

export interface MatchExplanation {
  slug: string;
  headline: string;
  body: string;
  caution?: string;
}

/**
 * Why each of these suits them. The scores are computed before this is called
 * and passed in; the model is told to use them and not to invent others, and
 * anything it returns for a scent we didn't ask about is dropped.
 */
export async function explainMatches(
  print: Scentprint,
  matches: ScentMatch[],
  fragrances: Fragrance[],
): Promise<AiResult<MatchExplanation[]>> {
  const wanted = new Set(matches.map((m) => m.frag.slug));
  const candidates = matches
    .map((m) => {
      const shared = m.shared.map((d) => `${DIM_SHORT[d]} (them ${print.dims[d]}, it ${m.dna[d]})`).join("; ");
      const contrast = m.contrast ? `${DIM_SHORT[m.contrast.dim]} is ${m.contrast.more ? "higher" : "lower"} than theirs (them ${print.dims[m.contrast.dim]}, it ${m.dna[m.contrast.dim]})` : "nothing pulls against them";
      return `${m.frag.slug} | ${m.frag.name} | compatibility ${m.percent}% | shares: ${shared || "no strong dimension"} | difference: ${contrast}`;
    })
    .join("\n");

  const res = await call<{ explanations: MatchExplanation[] }>("explain", {
    print: printPayload(print),
    candidates,
    catalogue: catalogueContext(fragrances),
  });
  if (isFailure(res)) return res;
  if (res?.ok) {
    const cleaned = res.result.explanations
      .filter((e) => wanted.has(e.slug))
      .map((e) => ({ slug: e.slug, headline: e.headline, body: e.body, caution: e.caution || undefined }));
    if (cleaned.length) return { ok: true, ai: true, result: cleaned };
  }
  // The engine's own sentence, which is what the cards already show.
  return {
    ok: true,
    ai: false,
    result: matches.map((m) => ({
      slug: m.frag.slug,
      headline: m.families.slice(0, 2).join(" · "),
      body: m.reason,
    })),
  };
}

// ─── F4 · AI Discovery Set ───────────────────────────────────────────────────

export interface CuratedSet {
  frags: Fragrance[];
  setName: string;
  rationale: string;
  roles: Record<string, { role: string; when: string }>;
}

export async function curateSet(
  print: Scentprint,
  fragrances: Fragrance[],
  size: number,
): Promise<AiResult<CuratedSet>> {
  const ranked = matchFragrances(print, fragrances, Math.max(size * 4, 16));
  if (ranked.length < size) return { ok: false, error: "Not enough on this shelf to build a set." };

  const candidates = ranked
    .map((m) => `${m.frag.slug} | ${m.frag.name} | ${m.percent}% | ${m.families.join(" ")} | ${m.frag.tagline}`)
    .join("\n");

  const res = await call<{ slugs: string[]; setName: string; rationale: string; roles: { slug: string; role: string; when: string }[] }>(
    "curate",
    { print: printPayload(print), candidates, size, catalogue: catalogueContext(fragrances) },
  );
  if (isFailure(res)) return res;
  if (res?.ok) {
    const bySlug = new Map(ranked.map((m) => [m.frag.slug, m.frag]));
    const picked = res.result.slugs.map((s) => bySlug.get(s)).filter((f): f is Fragrance => !!f);
    // Only trust a set the model actually filled from the candidates.
    if (picked.length === size) {
      return {
        ok: true,
        ai: true,
        result: {
          frags: picked,
          setName: res.result.setName,
          rationale: res.result.rationale,
          roles: Object.fromEntries((res.result.roles ?? []).map((r) => [r.slug, { role: r.role, when: r.when }])),
        },
      };
    }
  }
  return { ok: true, ai: false, result: diverseSet(ranked, size) };
}

/**
 * A set without a model: take the closest match, then keep adding whichever
 * strong candidate smells least like everything already chosen. Five near-
 * identical top scorers teach the customer nothing.
 */
function diverseSet(ranked: ScentMatch[], size: number): CuratedSet {
  const chosen: ScentMatch[] = [ranked[0]];
  const distance = (a: ScentVector, b: ScentVector) =>
    SCENT_DIMS.reduce((sum, d) => sum + Math.abs(a[d] - b[d]), 0) / SCENT_DIMS.length;

  while (chosen.length < size) {
    let best: ScentMatch | null = null;
    let bestScore = -Infinity;
    for (const m of ranked) {
      if (chosen.some((c) => c.frag.id === m.frag.id)) continue;
      const apart = Math.min(...chosen.map((c) => distance(c.dna, m.dna)));
      // Compatibility still matters; distance is what breaks the sameness.
      const score = m.percent * 0.55 + apart * 1.9;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    if (!best) break;
    chosen.push(best);
  }
  return {
    frags: chosen.map((m) => m.frag),
    setName: "Your discovery set",
    rationale: `Your closest match, then ${chosen.length - 1} that each move somewhere different — so a week of wearing them tells you something.`,
    roles: Object.fromEntries(
      chosen.map((m, i) => [m.frag.slug, { role: i === 0 ? "the closest" : i === chosen.length - 1 ? "the stretch" : "a different direction", when: m.frag.tagline }]),
    ),
  };
}

// ─── F6 · Familiar ↔ Adventurous ─────────────────────────────────────────────

export type Stretch = "home" | "step" | "leap";

export interface ExplorePick {
  slug: string;
  stretch: Stretch;
  reason: string;
}

export async function exploreMatches(
  print: Scentprint,
  matches: ScentMatch[],
  fragrances: Fragrance[],
  adventurousness: number,
): Promise<AiResult<ExplorePick[]>> {
  const pool = matches.slice(0, 18);
  const candidates = pool
    .map((m) => `${m.frag.slug} | ${m.frag.name} | ${m.percent}% | ${m.families.join(" ")} | ${m.frag.tagline}`)
    .join("\n");

  const res = await call<{ picks: ExplorePick[] }>("explore", {
    print: printPayload(print),
    candidates,
    adventurousness,
    catalogue: catalogueContext(fragrances),
  });
  if (isFailure(res)) return res;
  if (res?.ok) {
    const known = new Set(pool.map((m) => m.frag.slug));
    const picks = res.result.picks.filter((p) => known.has(p.slug)).slice(0, 10);
    if (picks.length) return { ok: true, ai: true, result: picks };
  }
  return { ok: true, ai: false, result: localExplore(pool, adventurousness) };
}

/**
 * Without a model: aim at a compatibility band rather than the top of the list.
 * At full adventurousness the target drops well below their best match, which
 * is what surfaces the scents an ordinary "closest first" list buries.
 */
function localExplore(pool: ScentMatch[], adventurousness: number): ExplorePick[] {
  if (!pool.length) return [];
  const best = pool[0].percent;
  const target = best - (adventurousness / 100) * Math.min(28, best - pool[pool.length - 1].percent);
  return [...pool]
    .sort((a, b) => Math.abs(a.percent - target) - Math.abs(b.percent - target))
    .slice(0, 8)
    .map((m) => {
      const gap = best - m.percent;
      const stretch: Stretch = gap < 5 ? "home" : gap < 14 ? "step" : "leap";
      const keeps = m.shared[0] ? DIM_SHORT[m.shared[0]].toLowerCase() : "your shape";
      const changes = m.contrast ? DIM_SHORT[m.contrast.dim].toLowerCase() : "the balance";
      return {
        slug: m.frag.slug,
        stretch,
        reason:
          stretch === "home"
            ? `Keeps your ${keeps} almost exactly.`
            : `Holds on to your ${keeps} and pushes the ${changes}.`,
      };
    });
}

// ─── F2 · Interpreting what they say about a scent ───────────────────────────

export interface FeedbackReading {
  adjustments: { key: ScentDim | Behaviour; delta: number }[];
  summary: string;
}

const DIM_SET = new Set<string>(SCENT_DIMS);
const BEH_SET = new Set<string>(BEHAVIOURS);

export async function interpretFeedback(feedback: string, about?: string): Promise<AiResult<FeedbackReading>> {
  const res = await call<{ adjustments: { dim: string; delta: number }[]; summary: string }>("interpret", { feedback, about });
  if (isFailure(res)) return res;
  if (res?.ok) {
    const adjustments = (res.result.adjustments ?? [])
      .filter((a) => DIM_SET.has(a.dim) || BEH_SET.has(a.dim))
      .map((a) => ({ key: a.dim as ScentDim | Behaviour, delta: Math.max(-40, Math.min(40, Math.round(a.delta))) }));
    return { ok: true, ai: true, result: { adjustments, summary: res.result.summary } };
  }
  return { ok: true, ai: false, result: localFeedback(feedback) };
}

/** Plain rules for the commonest things people say about a fragrance. */
const FEEDBACK_RULES: { test: RegExp; key: ScentDim | Behaviour; delta: number }[] = [
  { test: /too sweet|sickly|cloying/i, key: "sweet", delta: -18 },
  { test: /not sweet enough|sweeter/i, key: "sweet", delta: 15 },
  { test: /too strong|overpowering|too much/i, key: "projection", delta: -20 },
  { test: /too (faint|weak|light)|can'?t smell|doesn'?t last/i, key: "projection", delta: 18 },
  { test: /doesn'?t last|fades/i, key: "longevity", delta: 18 },
  { test: /too (heavy|thick)|suffocating/i, key: "intensity", delta: -18 },
  { test: /too (masculine|sharp)|harsh/i, key: "smoky", delta: -14 },
  { test: /too (floral|flowery)/i, key: "floral", delta: -16 },
  { test: /too (woody|dry)/i, key: "woody", delta: -14 },
  { test: /too (fresh|clean|soapy)|smells like soap/i, key: "clean", delta: -16 },
  { test: /love|perfect|exactly|obsessed/i, key: "familiarity", delta: 6 },
  { test: /boring|plain|forgettable|安全|too safe/i, key: "adventurousness", delta: 16 },
  { test: /too (weird|strange|odd)/i, key: "adventurousness", delta: -16 },
];

function localFeedback(feedback: string): FeedbackReading {
  const adjustments = FEEDBACK_RULES.filter((r) => r.test.test(feedback)).map((r) => ({ key: r.key, delta: r.delta }));
  return {
    adjustments,
    summary: adjustments.length ? "Noted — your Scentprint has moved a little." : "Nothing in that changes your Scentprint.",
  };
}
