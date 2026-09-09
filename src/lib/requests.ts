// Scent requests: what customers asked for that "Find my match" couldn't
// place. Writes go through the request_scent RPC when Supabase is configured;
// in demo mode they live in localStorage so the admin console can still show
// the flow end to end.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "./supabase";

export type RequestStatus = "open" | "sourced" | "declined";

export interface ScentRequest {
  id: string;
  query: string;
  queryKey: string;
  email: string | null;
  status: RequestStatus;
  createdAt: string; // ISO
}

/** One row per distinct ask, for the admin list. */
export interface RequestGroup {
  key: string;
  query: string; // most recent spelling
  count: number;
  emails: string[];
  latest: string; // ISO
  status: RequestStatus;
  ids: string[];
}

export function requestKey(query: string): string {
  return query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// ─── Demo store (no Supabase) ────────────────────────────────────────────────
const DEMO_KEY = "mo:scent-requests";
let demoRows: ScentRequest[] | null = null;
const listeners = new Set<() => void>();

function loadDemo(): ScentRequest[] {
  if (demoRows) return demoRows;
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    demoRows = raw ? (JSON.parse(raw) as ScentRequest[]) : [];
  } catch {
    demoRows = [];
  }
  return demoRows;
}

function saveDemo(rows: ScentRequest[]) {
  demoRows = rows;
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
  } catch {
    /* private mode etc. — keep the in-memory copy */
  }
  listeners.forEach((l) => l());
}

/** Demo: every request this browser has lodged (for the taste profile). */
export function demoRequestQueries(): string[] {
  return loadDemo().map((r) => r.query);
}

function subscribeDemo(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Lodges a request. Resolves true when stored; false only when a configured
 * backend rejects it (the demo store always succeeds).
 */
export async function submitScentRequest(query: string, email?: string): Promise<boolean> {
  const q = query.trim().slice(0, 200);
  if (!q) return false;
  const mail = email?.trim().slice(0, 200) || null;
  if (!supabase) {
    saveDemo([
      { id: `demo-${Date.now()}`, query: q, queryKey: requestKey(q), email: mail, status: "open", createdAt: new Date().toISOString() },
      ...loadDemo(),
    ]);
    return true;
  }
  try {
    const { error } = await supabase.rpc("request_scent", { p_query: q, p_email: mail });
    return !error;
  } catch {
    return false;
  }
}

export async function setRequestStatus(ids: string[], status: RequestStatus): Promise<boolean> {
  if (!ids.length) return true;
  if (!supabase) {
    saveDemo(loadDemo().map((r) => (ids.includes(r.id) ? { ...r, status } : r)));
    return true;
  }
  try {
    const { error } = await supabase.from("scent_requests").update({ status }).in("id", ids);
    return !error;
  } catch {
    return false;
  }
}

interface RequestRow {
  id: string;
  query: string;
  query_key: string;
  email: string | null;
  status: RequestStatus;
  created_at: string;
}

/** Admin: every request, newest first. Live from Supabase, else the demo store. */
export function useScentRequests() {
  const demo = useSyncExternalStore(subscribeDemo, loadDemo, () => []);
  const [remote, setRemote] = useState<ScentRequest[] | null>(null);
  const [loading, setLoading] = useState(!!supabase);

  const reload = useCallback(() => {
    if (!supabase) return;
    void supabase
      .from("scent_requests")
      .select("id, query, query_key, email, status, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setRemote(
            (data as RequestRow[]).map((r) => ({ id: r.id, query: r.query, queryKey: r.query_key, email: r.email, status: r.status, createdAt: r.created_at })),
          );
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => reload(), [reload]);

  const rows = supabase ? (remote ?? []) : demo;
  return { requests: rows, groups: groupRequests(rows), loading, reload };
}

/** Collapses repeat asks for the same scent into one line with a count. */
export function groupRequests(rows: ScentRequest[]): RequestGroup[] {
  const map = new Map<string, RequestGroup>();
  for (const r of rows) {
    const g = map.get(r.queryKey);
    if (!g) {
      map.set(r.queryKey, { key: r.queryKey, query: r.query, count: 1, emails: r.email ? [r.email] : [], latest: r.createdAt, status: r.status, ids: [r.id] });
      continue;
    }
    g.count += 1;
    g.ids.push(r.id);
    if (r.email && !g.emails.includes(r.email)) g.emails.push(r.email);
    if (r.createdAt > g.latest) {
      g.latest = r.createdAt;
      g.query = r.query;
    }
    // A group is "open" if any ask in it still is.
    if (r.status === "open") g.status = "open";
  }
  return [...map.values()].sort((a, b) => (a.status === b.status ? b.count - a.count || b.latest.localeCompare(a.latest) : a.status === "open" ? -1 : 1));
}
