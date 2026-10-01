// Admin → Analytics: the reports over the storefront's own event log
// (supabase/migrations/0036_site_analytics.sql). Every call is an admin-only
// RPC; without Supabase there is nothing recorded to report on.

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface Overview {
  visitors: number;
  sessions: number;
  pageviews: number;
  pages_per_session: number | null;
  avg_seconds: number | null;
  bounce_rate: number | null;
  cart_rate: number | null;
  conversion_rate: number | null;
  revenue: number;
  orders: number;
  daily: { day: string; sessions: number; orders: number }[];
  sources: { source: string; sessions: number; orders: number }[];
  devices: { device: string; sessions: number; orders: number }[];
}
export interface FunnelStep {
  step: string;
  sessions: number;
}
export interface PageRow {
  path: string;
  views: number;
  sessions: number;
  landings: number;
  exits: number;
  scroll: number | null;
}
export interface Flow {
  from: string;
  to: string;
  count: number;
}
export interface Journey {
  session: string;
  started: string;
  seconds: number;
  bought: boolean;
  carted: boolean;
  revenue: number | null;
  device: string | null;
  source: string | null;
  steps: { t: string; kind: "page" | "event"; path: string; name: string | null; value: number | null }[];
}
export interface Heatmap {
  clicks: [number, number, number][];
  labels: { label: string; clicks: number }[];
  scroll: { visits: number; reached25: number; reached50: number; reached75: number; reached100: number };
}
export type JourneyFilter = "all" | "carted" | "purchased" | "abandoned";
export type Device = "desktop" | "tablet" | "mobile";

interface Result<T> {
  /** The arguments + version this result answers, so a newer request reads as loading. */
  key: string;
  data: T | null;
  error: string | null;
}

/** One admin report, re-fetched when its arguments change. */
export function useReport<T>(fn: string, args: Record<string, unknown> | null): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [result, setResult] = useState<Result<T> | null>(null);
  const [version, setVersion] = useState(0);
  const key = args ? JSON.stringify(args) : "";
  const want = `${fn}|${key}|${version}`;
  useEffect(() => {
    if (!supabase || !key) return;
    let live = true;
    void supabase.rpc(fn, JSON.parse(key)).then(({ data, error }) => {
      if (live) setResult({ key: `${fn}|${key}|${version}`, data: (data as T) ?? null, error: error ? error.message : null });
    });
    return () => {
      live = false;
    };
  }, [fn, key, version]);
  const current = result?.key === want ? result : null;
  return {
    // Keep showing the last result while a new range loads, rather than flashing empty.
    data: current?.data ?? result?.data ?? null,
    loading: !!supabase && !!key && !current,
    error: current?.error ?? null,
    reload: () => setVersion((v) => v + 1),
  };
}

/** Deletes events older than `days` (the database keeps at least 30). */
export async function purgeEvents(days: number): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("purge_site_events", { p_days: days });
  return error ? null : (data as number);
}
