// ─── Customer profile: consent, and the taste profile behind personalisation ─
//
// Two consents, both off until the person says yes:
//   • marketing — email about new batches and offers
//   • ai        — the concierge and the surprise draw may use their history
// The taste profile is derived on demand from what they bought, subscribed to,
// requested and asked the concierge; it is never stored, only summarised.
//
// Storage mirrors the rest of the app: Supabase RPCs when configured
// (migration 0014), localStorage in demo mode.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { AuthUser } from "./auth";
import type { Fragrance, FormatKey } from "./data";
import { type Mood, MOODS, moodsOf, profileOf, referenceOf, FORMAT_BY_KEY } from "./formats";
import type { Subscription } from "./subscription";
import { supabase } from "./supabase";

// ─── Consents ────────────────────────────────────────────────────────────────

export interface Consents {
  marketing: boolean;
  ai: boolean;
  marketingAt?: string | null;
  aiAt?: string | null;
}

export const NO_CONSENT: Consents = { marketing: false, ai: false };

const DEMO_CONSENTS = "mo:consents";
const DEMO_SIGNUPS = "mo:inner-circle";
const PENDING = "mo:pending-consents";

let demoConsentCache: Consents | null = null;
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribeDemo(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}
function loadDemoConsents(): Consents {
  if (!demoConsentCache) demoConsentCache = readJson<Consents>(DEMO_CONSENTS, NO_CONSENT);
  return demoConsentCache;
}

export interface Signup {
  email: string;
  source: string;
  optedIn: boolean;
  createdAt: string;
}

/** Demo: the consents this browser has recorded. */
export function demoConsents(): Consents {
  return loadDemoConsents();
}

/** Demo: the inner-circle list this browser has collected. */
export function demoSignups(): Signup[] {
  return readJson<Signup[]>(DEMO_SIGNUPS, []);
}

/** Footer box: anonymous inner-circle signup (marketing consent by email). */
export async function joinInnerCircle(email: string, source = "footer"): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  if (!supabase) {
    const rows = demoSignups().filter((s) => s.email !== e);
    writeJson(DEMO_SIGNUPS, [{ email: e, source, optedIn: true, createdAt: new Date().toISOString() }, ...rows]);
    emit();
    return true;
  }
  try {
    const { error } = await supabase.rpc("join_inner_circle", { p_email: e, p_source: source });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Saves both consents for the signed-in customer. When there is no session
 * yet (email sign-up awaiting confirmation) they are parked locally and
 * applied by useConsents the moment a session appears.
 */
export async function setConsents(c: Consents, source = "account", email?: string | null): Promise<boolean> {
  const now = new Date().toISOString();
  if (!supabase) {
    demoConsentCache = { marketing: c.marketing, ai: c.ai, marketingAt: c.marketing ? (loadDemoConsents().marketingAt ?? now) : null, aiAt: c.ai ? (loadDemoConsents().aiAt ?? now) : null };
    writeJson(DEMO_CONSENTS, demoConsentCache);
    if (email) {
      const e = email.trim().toLowerCase();
      const rows = demoSignups().filter((s) => s.email !== e);
      writeJson(DEMO_SIGNUPS, [{ email: e, source, optedIn: c.marketing, createdAt: now }, ...rows]);
    }
    emit();
    return true;
  }
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      writeJson(PENDING, { marketing: c.marketing, ai: c.ai, source });
      return true;
    }
    const { error } = await supabase.rpc("set_my_consents", { p_marketing: c.marketing, p_ai: c.ai, p_source: source });
    return !error;
  } catch {
    return false;
  }
}

interface ProfileRow {
  marketing_opt_in: boolean;
  marketing_opt_in_at: string | null;
  ai_opt_in: boolean;
  ai_opt_in_at: string | null;
}

/** The signed-in customer's consents; NO_CONSENT until known. */
export function useConsents(user: AuthUser | null) {
  const demo = useSyncExternalStore(subscribeDemo, loadDemoConsents, () => NO_CONSENT);
  const [remote, setRemote] = useState<Consents | null>(null);
  const userId = user?.id ?? null;

  const reload = useCallback(() => {
    if (!supabase || !userId) return;
    void (async () => {
      // Apply consents parked at sign-up, once.
      const pending = readJson<{ marketing: boolean; ai: boolean; source: string } | null>(PENDING, null);
      if (pending) {
        try {
          localStorage.removeItem(PENDING);
        } catch {
          /* ignore */
        }
        await supabase.rpc("set_my_consents", { p_marketing: pending.marketing, p_ai: pending.ai, p_source: pending.source });
      }
      const { data } = await supabase.from("customer_profiles").select("marketing_opt_in, marketing_opt_in_at, ai_opt_in, ai_opt_in_at").eq("user_id", userId).maybeSingle();
      const r = data as ProfileRow | null;
      setRemote(r ? { marketing: r.marketing_opt_in, ai: r.ai_opt_in, marketingAt: r.marketing_opt_in_at, aiAt: r.ai_opt_in_at } : NO_CONSENT);
    })();
  }, [userId]);

  useEffect(() => reload(), [reload]);

  const consents = supabase ? (user ? (remote ?? NO_CONSENT) : NO_CONSENT) : user ? demo : NO_CONSENT;
  return { consents, reload };
}

// ─── Taste profile ───────────────────────────────────────────────────────────

export interface TasteInput {
  /** Bought or reserved: one entry per unit. */
  purchases: { fragranceId: string; format: FormatKey | string | null }[];
  subscriptions: Subscription[];
  /** Free-text scent requests ("Bleu de Chanel"). */
  requests: string[];
  /** The customer's own concierge messages. */
  chats: string[];
}

export interface TasteProfile {
  empty: boolean;
  moods: { id: Mood; weight: number }[]; // normalised 0..1, descending
  notes: { note: string; weight: number }[];
  favourites: { fragrance: Fragrance; weight: number }[];
  formats: { key: FormatKey; count: number }[];
  requested: string[];
  summary: string;
}

const W = { purchase: 3, delivery: 2, nextPick: 1, chatMention: 0.75, request: 0.5 };

function add(map: Map<string, number>, key: string, w: number) {
  map.set(key, (map.get(key) ?? 0) + w);
}

/** Derives a taste profile from a customer's history against the catalogue. */
export function buildTasteProfile(frags: Fragrance[], input: TasteInput): TasteProfile {
  const byId = new Map(frags.map((f) => [f.id, f]));
  const fav = new Map<string, number>();
  const formats = new Map<string, number>();

  for (const p of input.purchases) {
    if (byId.has(p.fragranceId)) add(fav, p.fragranceId, W.purchase);
    if (p.format && p.format in FORMAT_BY_KEY) add(formats, p.format, 1);
  }
  for (const s of input.subscriptions) {
    add(formats, s.format, 1);
    for (const d of s.deliveries) if (byId.has(d.fragranceId)) add(fav, d.fragranceId, W.delivery);
    if (s.pickMode === "choose" && s.nextFragranceId && byId.has(s.nextFragranceId)) add(fav, s.nextFragranceId, W.nextPick);
  }
  const chatText = input.chats.join(" \n ").toLowerCase();
  if (chatText) {
    for (const f of frags) {
      const ref = referenceOf(f);
      const names = [f.name, ref.fragrance].filter(Boolean).map((n) => n.toLowerCase());
      if (names.some((n) => n.length > 3 && chatText.includes(n))) add(fav, f.id, W.chatMention);
    }
  }

  // Moods and notes: from favourites, plus mood words and notes named in requests/chat.
  const moods = new Map<string, number>();
  const notes = new Map<string, number>();
  for (const [id, w] of fav) {
    const f = byId.get(id)!;
    for (const m of moodsOf(f)) add(moods, m, w);
    for (const n of [...f.top, ...f.heart, ...f.base]) add(notes, n.toLowerCase(), w / 3);
  }
  const freeText = [...input.requests, ...input.chats].join(" \n ").toLowerCase();
  if (freeText) {
    for (const m of MOODS) {
      if (freeText.includes(m.id.toLowerCase())) add(moods, m.id, W.request);
      for (const hint of m.hint.split(",").map((h) => h.trim())) if (hint && freeText.includes(hint)) add(moods, m.id, W.request / 2);
    }
    const allNotes = new Set(frags.flatMap((f) => [...f.top, ...f.heart, ...f.base]).map((n) => n.toLowerCase()));
    for (const n of allNotes) if (n.length > 3 && freeText.includes(n)) add(notes, n, W.request);
  }

  const norm = (m: Map<string, number>) => {
    const max = Math.max(0, ...m.values());
    return [...m.entries()].map(([k, v]) => [k, max ? v / max : 0] as const).sort((a, b) => b[1] - a[1]);
  };
  const favourites = [...fav.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, weight]) => ({ fragrance: byId.get(id)!, weight }));
  const profile: TasteProfile = {
    empty: fav.size === 0 && moods.size === 0 && input.requests.length === 0,
    moods: norm(moods).slice(0, 4).map(([id, weight]) => ({ id: id as Mood, weight })),
    notes: norm(notes).slice(0, 6).map(([note, weight]) => ({ note, weight })),
    favourites,
    formats: [...formats.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key: key as FormatKey, count })),
    requested: [...new Set(input.requests.map((r) => r.trim()).filter(Boolean))].slice(0, 5),
    summary: "",
  };
  profile.summary = tasteSummary(profile);
  return profile;
}

/** Compact prose for the concierge prompt and the admin list. */
export function tasteSummary(p: TasteProfile): string {
  if (p.empty) return "No history yet.";
  const parts: string[] = [];
  if (p.favourites.length) parts.push(`Owns or chose: ${p.favourites.map((f) => `${f.fragrance.name} (${profileOf(f.fragrance).join("/")})`).join(", ")}.`);
  if (p.moods.length) parts.push(`Leans ${p.moods.map((m) => m.id.toLowerCase()).join(", ")}.`);
  if (p.notes.length) parts.push(`Notes they return to: ${p.notes.map((n) => n.note).join(", ")}.`);
  if (p.formats.length) parts.push(`Usually buys ${p.formats.map((f) => FORMAT_BY_KEY[f.key]?.name ?? f.key).join(", ")}.`);
  if (p.requested.length) parts.push(`Asked for scents we don't carry: ${p.requested.join(", ")}.`);
  return parts.join(" ");
}

/**
 * Affinity of a fragrance to a profile, for the surprise draw: 1 for a
 * stranger, up to ~4 for a scent squarely in their moods and notes.
 */
export function affinityOf(p: TasteProfile | null): (f: Fragrance) => number {
  if (!p || p.empty) return () => 1;
  const mood = new Map(p.moods.map((m) => [m.id, m.weight]));
  const note = new Map(p.notes.map((n) => [n.note, n.weight]));
  return (f) => {
    const ms = moodsOf(f);
    const moodScore = ms.length ? ms.reduce((s, m) => s + (mood.get(m) ?? 0), 0) / ms.length : 0;
    const ns = [...f.top, ...f.heart, ...f.base].map((n) => n.toLowerCase());
    const noteScore = ns.length ? ns.reduce((s, n) => s + (note.get(n) ?? 0), 0) / ns.length : 0;
    return 1 + 2 * moodScore + noteScore;
  };
}

// ─── The signed-in customer's own history → profile ─────────────────────────

interface RequestRow {
  query: string;
}
interface ChatRow {
  content: string;
}

/**
 * Builds the signed-in customer's taste profile from their own data (RLS
 * limits every read to their rows). Returns null when there is no user or
 * the profile is still loading. Callers gate on the AI consent.
 */
export function useMyTaste(user: AuthUser | null, fragrances: Fragrance[], subscriptions: Subscription[], localPurchases: TasteInput["purchases"], localRequests: string[]) {
  const [remote, setRemote] = useState<{ purchases: TasteInput["purchases"]; requests: string[]; chats: string[] } | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;
    void (async () => {
      const [c, r, m] = await Promise.all([
        supabase.from("commits").select("fragrance_id, format").eq("user_id", userId),
        supabase.from("scent_requests").select("query").eq("user_id", userId),
        supabase.from("chat_messages").select("content").eq("user_id", userId).eq("role", "user").order("created_at", { ascending: false }).limit(60),
      ]);
      if (!active) return;
      setRemote({
        purchases: ((c.data ?? []) as { fragrance_id: string; format: string | null }[]).map((x) => ({ fragranceId: x.fragrance_id, format: x.format })),
        requests: ((r.data ?? []) as RequestRow[]).map((x) => x.query),
        chats: ((m.data ?? []) as ChatRow[]).map((x) => x.content),
      });
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  return useMemo(() => {
    if (!user) return null;
    if (supabase) {
      if (!remote) return null;
      return buildTasteProfile(fragrances, { ...remote, subscriptions });
    }
    return buildTasteProfile(fragrances, { purchases: localPurchases, subscriptions, requests: localRequests, chats: [] });
  }, [user, remote, fragrances, subscriptions, localPurchases, localRequests]);
}
