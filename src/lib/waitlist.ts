// The waitlist behind every "Notify me": a fragrance before its launch date,
// or a format marked Coming soon. Sign-ups go through the join_waitlist RPC
// (anyone can join, nobody but an admin can read the list); in demo mode they
// live in localStorage so the admin console can still show the flow.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { FormatKey } from "./data";
import { supabase } from "./supabase";

export interface WaitlistEntry {
  id: string;
  fragranceId: string;
  format: FormatKey | null; // null: the fragrance's launch
  email: string;
  createdAt: string;
  notifiedAt: string | null;
}

/** One line per fragrance + format, for the admin list. */
export interface WaitlistGroup {
  key: string;
  fragranceId: string;
  format: FormatKey | null;
  waiting: number;
  notified: number;
  latest: string;
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ─── Demo store (no Supabase) ────────────────────────────────────────────────
const DEMO_KEY = "mo:waitlist";
let demoRows: WaitlistEntry[] | null = null;
const listeners = new Set<() => void>();

function loadDemo(): WaitlistEntry[] {
  if (demoRows) return demoRows;
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    demoRows = raw ? (JSON.parse(raw) as WaitlistEntry[]) : [];
  } catch {
    demoRows = [];
  }
  return demoRows;
}

function saveDemo(rows: WaitlistEntry[]) {
  demoRows = rows;
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
  } catch {
    /* private mode etc. — keep the in-memory copy */
  }
  listeners.forEach((l) => l());
}

function subscribeDemo(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Signs an email up for one "it's here" email. Resolves false if it wasn't stored. */
export async function joinWaitlist(fragranceId: string, format: FormatKey | null, email: string): Promise<boolean> {
  const mail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(mail) || mail.length > 200) return false;
  if (!supabase) {
    const rows = loadDemo();
    if (!rows.some((r) => r.fragranceId === fragranceId && r.format === format && r.email === mail)) {
      saveDemo([{ id: `demo-${Date.now()}`, fragranceId, format, email: mail, createdAt: new Date().toISOString(), notifiedAt: null }, ...rows]);
    }
    return true;
  }
  try {
    const { error } = await supabase.rpc("join_waitlist", { p_fragrance_id: fragranceId, p_format: format, p_email: mail });
    return !error;
  } catch {
    return false;
  }
}

interface WaitlistRow {
  id: string;
  fragrance_id: string;
  format: FormatKey | null;
  email: string;
  created_at: string;
  notified_at: string | null;
}

/** Admin: the whole list, grouped. Live from Supabase, else the demo store. */
export function useWaitlist() {
  const demo = useSyncExternalStore(subscribeDemo, loadDemo, () => []);
  const [remote, setRemote] = useState<WaitlistEntry[] | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!supabase) return;
    void supabase
      .from("waitlist")
      .select("id, fragrance_id, format, email, created_at, notified_at")
      .order("created_at", { ascending: false })
      .limit(5000)
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        else if (data) {
          setError(null);
          setRemote(
            (data as WaitlistRow[]).map((r) => ({ id: r.id, fragranceId: r.fragrance_id, format: r.format, email: r.email, createdAt: r.created_at, notifiedAt: r.notified_at })),
          );
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => reload(), [reload]);

  const rows = supabase ? (remote ?? []) : demo;
  return { entries: rows, groups: groupWaitlist(rows), loading, error, reload };
}

export function groupWaitlist(rows: WaitlistEntry[]): WaitlistGroup[] {
  const map = new Map<string, WaitlistGroup>();
  for (const r of rows) {
    const key = `${r.fragranceId}:${r.format ?? ""}`;
    const g = map.get(key) ?? { key, fragranceId: r.fragranceId, format: r.format, waiting: 0, notified: 0, latest: r.createdAt };
    if (r.notifiedAt) g.notified += 1;
    else g.waiting += 1;
    if (r.createdAt > g.latest) g.latest = r.createdAt;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.waiting - a.waiting || b.latest.localeCompare(a.latest));
}

export type NotifyResult = { ok: true; sent: number; failed: number } | { ok: false; error: string };

/**
 * Admin: emails everyone waiting on this fragrance (format null) or format
 * that it has arrived, once each. Demo mode just marks them notified.
 */
export async function notifyWaitlist(fragranceId: string, format: FormatKey | null): Promise<NotifyResult> {
  if (!supabase) {
    let sent = 0;
    saveDemo(
      loadDemo().map((r) => {
        if (r.fragranceId !== fragranceId || r.format !== format || r.notifiedAt) return r;
        sent += 1;
        return { ...r, notifiedAt: new Date().toISOString() };
      }),
    );
    return { ok: true, sent, failed: 0 };
  }
  try {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    const res = await fetch("/api/marketing", { method: "POST", headers, body: JSON.stringify({ action: "waitlist-notify", fragranceId, format }) });
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) return { ok: false, error: `The email route isn't deployed (${res.status})` };
    const body = (await res.json()) as { sent?: number; failed?: number; error?: string; detail?: string };
    if (!res.ok) return { ok: false, error: [body.error ?? `Request failed (${res.status})`, body.detail].filter(Boolean).join(": ") };
    return { ok: true, sent: body.sent ?? 0, failed: body.failed ?? 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
