// ─── The learning Scentprint ─────────────────────────────────────────────────
//
// The print someone answers their way to is a snapshot. What makes it worth
// holding is that it sharpens — every sample worn, every bottle bought, every
// "it was too sweet" moves it, and the profile shown is always the original
// print with those signals applied on top.
//
// Two properties this is built for:
//   • the raw answers are never overwritten, so learning can be replayed,
//     explained to the customer, or undone
//   • the maths is deterministic and lives here, not in a model. The only
//     thing a model does is read a sentence of free text and propose deltas,
//     which then go through exactly the same merge as everything else.

import type { Fragrance } from "./data";
import { interpretFeedback } from "./scentai";
import {
  BEHAVIOURS,
  SCENT_DIMS,
  clamp,
  fragranceDna,
  type Behaviour,
  type ScentDim,
  type Scentprint,
} from "./scentdna";
import { supabase } from "./supabase";

export type SignalKind = "purchase" | "sample" | "loved" | "passed" | "feedback" | "retake";

export interface ScentSignal {
  kind: SignalKind;
  fragranceId?: string | null;
  /** Scentprint points, keyed by dimension or behavioural axis. */
  adjustments: Partial<Record<ScentDim | Behaviour, number>>;
  note?: string | null;
  weight: number;
  createdAt: string;
}

/**
 * How hard each kind of signal pulls. Buying a bottle is a far stronger
 * statement than adding a sample to a bag, and passing on something is
 * deliberately gentler than either — a person skipping a scent has told you
 * much less than a person wearing one for a month.
 */
const PULL: Record<SignalKind, number> = {
  purchase: 0.16,
  sample: 0.07,
  loved: 0.2,
  passed: -0.09,
  feedback: 1, // feedback carries explicit deltas rather than a pull
  retake: 1,
};

/** Signals fade: what someone liked two years ago is not what they like now. */
const HALF_LIFE_DAYS = 240;

function decay(createdAt: string): number {
  const age = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  if (!Number.isFinite(age) || age <= 0) return 1;
  return Math.pow(0.5, age / HALF_LIFE_DAYS);
}

/**
 * Wearing something is a statement about the whole scent, not one dimension:
 * the print moves a fraction of the way toward what they actually wore.
 */
export function adjustmentsFromFragrance(frag: Fragrance, print: Scentprint, kind: SignalKind): Partial<Record<ScentDim, number>> {
  const pull = PULL[kind];
  if (!pull || kind === "feedback" || kind === "retake") return {};
  const dna = fragranceDna(frag);
  const out: Partial<Record<ScentDim, number>> = {};
  for (const d of SCENT_DIMS) {
    const delta = Math.round((dna[d] - print.dims[d]) * pull);
    if (delta !== 0) out[d] = Math.max(-40, Math.min(40, delta));
  }
  return out;
}

/**
 * The print as it stands: the original, plus every signal weighted and faded.
 * Pure — same inputs, same output — so the "what changed" read-out below can
 * be derived rather than stored.
 */
export function learnedPrint(base: Scentprint, signals: ScentSignal[]): Scentprint {
  if (!signals.length) return base;
  const dims = { ...base.dims };
  const behaviour = { ...base.behaviour };

  for (const signal of signals) {
    const strength = signal.weight * decay(signal.createdAt);
    for (const [key, delta] of Object.entries(signal.adjustments)) {
      if (typeof delta !== "number" || !Number.isFinite(delta)) continue;
      const move = delta * strength;
      if ((SCENT_DIMS as readonly string[]).includes(key)) {
        dims[key as ScentDim] = clamp(dims[key as ScentDim] + move);
      } else if ((BEHAVIOURS as readonly string[]).includes(key)) {
        behaviour[key as Behaviour] = clamp(behaviour[key as Behaviour] + move);
      }
    }
  }
  for (const d of SCENT_DIMS) dims[d] = Math.round(dims[d]);
  for (const b of BEHAVIOURS) behaviour[b] = Math.round(behaviour[b]);
  // Familiarity is defined as the inverse of adventurousness; keep it so.
  behaviour.familiarity = clamp(100 - behaviour.adventurousness);
  return { ...base, dims, behaviour };
}

/** The biggest moves learning has made, for showing the customer its working. */
export function whatChanged(base: Scentprint, learned: Scentprint, limit = 3): { key: ScentDim | Behaviour; from: number; to: number }[] {
  const keys: (ScentDim | Behaviour)[] = [...SCENT_DIMS, ...BEHAVIOURS];
  return keys
    .map((key) => {
      const from = (SCENT_DIMS as readonly string[]).includes(key) ? base.dims[key as ScentDim] : base.behaviour[key as Behaviour];
      const to = (SCENT_DIMS as readonly string[]).includes(key) ? learned.dims[key as ScentDim] : learned.behaviour[key as Behaviour];
      return { key, from, to };
    })
    .filter((x) => Math.abs(x.to - x.from) >= 3)
    .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))
    .slice(0, limit);
}

// ─── Storage ─────────────────────────────────────────────────────────────────
// Supabase when configured, this browser otherwise, exactly like the rest of
// the app. A signal is never worth failing anything else over, so every write
// here is best-effort.

const DEMO_KEY = "mo:scent-signals";

function readDemo(): ScentSignal[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as ScentSignal[]) : [];
  } catch {
    return [];
  }
}

function writeDemo(rows: ScentSignal[]): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(rows.slice(0, 400)));
  } catch {
    /* private mode — learning simply doesn't persist */
  }
}

export async function recordSignal(
  code: string | null,
  signal: Omit<ScentSignal, "createdAt" | "weight"> & { weight?: number },
): Promise<void> {
  const row: ScentSignal = {
    ...signal,
    weight: signal.weight ?? 1,
    createdAt: new Date().toISOString(),
  };
  if (!Object.keys(row.adjustments).length && !row.note) return;

  if (!supabase) {
    writeDemo([row, ...readDemo()]);
    return;
  }
  try {
    // supabase-js reports failures in `error` rather than throwing, so a
    // returned error has to be checked as carefully as a thrown one — missing
    // that is how a signal silently disappears.
    const { error } = await supabase.rpc("record_scent_signal", {
      p_code: code,
      p_kind: row.kind,
      p_adjustments: row.adjustments,
      p_fragrance_id: row.fragranceId ?? null,
      p_note: row.note ?? null,
      p_weight: row.weight,
    });
    if (error) writeDemo([row, ...readDemo()]);
  } catch {
    // Fall back to the browser so the profile still sharpens in this session.
    writeDemo([row, ...readDemo()]);
  }
}

interface SignalRow {
  kind: SignalKind;
  fragrance_id: string | null;
  adjustments: Record<string, number> | null;
  note: string | null;
  weight: number;
  created_at: string;
}

export async function loadSignals(code: string | null): Promise<ScentSignal[]> {
  if (!supabase) return readDemo();
  try {
    const { data, error } = await supabase.rpc("scent_signals_for", { p_code: code });
    if (error || !Array.isArray(data)) return readDemo();
    return (data as SignalRow[]).map((r) => ({
      kind: r.kind,
      fragranceId: r.fragrance_id,
      adjustments: (r.adjustments ?? {}) as ScentSignal["adjustments"],
      note: r.note,
      weight: r.weight,
      createdAt: r.created_at,
    }));
  } catch {
    return readDemo();
  }
}

// ─── The two ways a signal gets made ─────────────────────────────────────────

/** They put a bottle or a sample in the bag, or passed on one. */
export async function recordWear(code: string | null, frag: Fragrance, print: Scentprint, kind: SignalKind): Promise<void> {
  await recordSignal(code, {
    kind,
    fragranceId: frag.id,
    adjustments: adjustmentsFromFragrance(frag, print, kind),
    note: frag.name,
  });
}

/**
 * They said something about a scent. The model reads it into deltas; without
 * one, a small set of rules covers the things people actually say. Either way
 * the deltas go through the same merge.
 */
export async function recordFeedback(
  code: string | null,
  feedback: string,
  about?: Fragrance,
): Promise<{ ok: boolean; summary: string; moved: number }> {
  const read = await interpretFeedback(feedback, about?.name);
  if (!read.ok) return { ok: false, summary: read.error, moved: 0 };
  const adjustments = Object.fromEntries(read.result.adjustments.map((a) => [a.key, a.delta]));
  if (!Object.keys(adjustments).length) {
    return { ok: true, summary: read.result.summary, moved: 0 };
  }
  await recordSignal(code, {
    kind: "feedback",
    fragranceId: about?.id ?? null,
    adjustments,
    note: feedback.slice(0, 400),
    weight: 1.2,
  });
  return { ok: true, summary: read.result.summary, moved: Object.keys(adjustments).length };
}
