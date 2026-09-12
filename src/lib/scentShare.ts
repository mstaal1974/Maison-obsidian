// ─── Keeping, sharing and re-opening a Scentprint ─────────────────────────────
//
// Three jobs:
//   • remember this browser's Scentprint, so "View my profile" works on return
//   • mint a short share code (maisonobsidian.com.au/scent/7HD92K) when Supabase
//     is configured, and fall back to a self-contained code when it isn't — the
//     link has to work from Instagram either way
//   • record a lead: the email is stored against the profile only when the
//     person asked us to send it, and marketing consent is a separate yes
//
// A code is numbers only. No name, no email, nothing personal travels in a URL.

import { joinInnerCircle } from "./profile";
import { decodeScentprint, encodeScentprint, isEncodedCode, scentprintFrom, type Scentprint } from "./scentdna";
import { supabase } from "./supabase";

const STORE_KEY = "mo:scentprint";

interface Stored {
  print: Scentprint;
  code: string | null;
  savedAt: string;
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return parsed?.print?.dims ? parsed : null;
  } catch {
    return null;
  }
}

/** This browser's Scentprint, if it has one. */
export function loadScentprint(): Scentprint | null {
  return readStored()?.print ?? null;
}

/** The share code last minted for this browser's Scentprint. */
export function loadScentCode(): string | null {
  return readStored()?.code ?? null;
}

export function storeScentprint(print: Scentprint, code: string | null = null): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ print, code, savedAt: new Date().toISOString() } satisfies Stored));
  } catch {
    /* private mode — the session still works, it just won't be remembered */
  }
}

export function clearScentprint(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * Mints a shareable code. With Supabase the profile is stored and a six-character
 * code comes back (and the row is the start of the customer's preference
 * profile); without it the whole Scentprint is encoded into the code itself so
 * the link still opens somebody else's result on the other side of the world.
 */
export async function publishScentprint(print: Scentprint, opts: { email?: string | null; source?: string } = {}): Promise<string> {
  const fallback = encodeScentprint(print);
  if (!supabase) return fallback;
  try {
    const { data, error } = await supabase.rpc("save_scentprint", {
      p_dims: print.dims,
      p_behaviour: print.behaviour,
      p_occasions: print.occasions,
      p_loves: print.loves ?? null,
      p_email: opts.email?.trim().toLowerCase() || null,
      p_source: opts.source ?? "discover",
      p_wearer: print.wearer ?? "all",
    });
    const code = typeof data === "string" ? data : null;
    return !error && code ? code : fallback;
  } catch {
    return fallback;
  }
}

interface ProfileRow {
  dims: Record<string, number>;
  behaviour: Record<string, number> | null;
  occasions: string[] | null;
  loves: string | null;
  wearer: string | null;
}

/** Opens a shared result: a stored code, or a code that carries its own payload. */
export async function fetchScentprint(code: string): Promise<Scentprint | null> {
  const c = code.trim();
  if (!c) return null;
  if (isEncodedCode(c)) return decodeScentprint(c);
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("get_scentprint", { p_code: c.toUpperCase() });
    const row = (Array.isArray(data) ? data[0] : data) as ProfileRow | null;
    if (error || !row?.dims) return null;
    return scentprintFrom(row.dims, row.behaviour ?? undefined, row.occasions ?? undefined, row.loves, row.wearer);
  } catch {
    return null;
  }
}

/** The campaign link for a result — the one that goes in a bio or a QR code. */
export function scentUrl(code: string): string {
  const origin = typeof window === "undefined" ? "https://maisonobsidian.com.au" : window.location.origin;
  return `${origin}/scent/${code}`;
}

/** The page's own canonical link, for "start yours". */
export function discoverUrl(): string {
  const origin = typeof window === "undefined" ? "https://maisonobsidian.com.au" : window.location.origin;
  return `${origin}/discover`;
}

export interface LeadResult {
  ok: boolean;
  code: string | null;
}

/**
 * Lead capture. The email is attached to the Scentprint so the house can send
 * it, and — only if they ticked the box — added to the marketing list with the
 * source recorded, exactly as the footer signup does.
 */
export async function captureScentLead(email: string, print: Scentprint, marketing: boolean): Promise<LeadResult> {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, code: null };
  // The result was already saved when it was revealed, so attach the email to
  // that row rather than writing a second copy of the same Scentprint.
  const existing = loadScentCode();
  const code = existing && !isEncodedCode(existing) && (await attachEmail(existing, e))
    ? existing
    : await publishScentprint(print, { email: e, source: "scent-dna" });
  storeScentprint(print, code);
  if (marketing) await joinInnerCircle(e, "scent-dna");
  return { ok: true, code };
}

async function attachEmail(code: string, email: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.rpc("attach_scentprint_email", { p_code: code, p_email: email });
    return !error;
  } catch {
    return false;
  }
}
