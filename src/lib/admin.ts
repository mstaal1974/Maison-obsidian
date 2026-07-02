import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Fragrance } from "./data";
import type { AuthUser } from "./auth";
import {
  demoUpsertFragrance,
  demoDeleteFragrance,
  demoSetStock,
  demoSetShipment,
  type DemoShipment,
} from "./catalogue";

/**
 * Whether the current user may use the admin console. In configured mode this
 * calls the is_admin() RPC (backed by the admins table). In demo mode any
 * signed-in user is treated as an admin so the console is testable offline.
 */
export function useIsAdmin(user: AuthUser | null): boolean {
  const [remoteAdmin, setRemoteAdmin] = useState(false);

  useEffect(() => {
    if (!supabase || !user?.id) return;
    let active = true;
    void supabase.rpc("is_admin").then(({ data }) => {
      if (active) setRemoteAdmin(data === true);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  if (!supabase) return !!user; // demo: signed-in ⇒ admin
  return remoteAdmin;
}

function toPayload(f: Fragrance): Record<string, unknown> {
  return {
    id: f.id || undefined,
    slug: f.slug,
    name: f.name,
    inspiration: f.inspiration,
    tagline: f.tagline,
    story: f.story,
    price_10ml_cents: f.price10,
    price_30ml_cents: f.price30,
    price_50ml_cents: f.price,
    gender: f.gender,
    moq: f.moq,
    liquid: f.liquid,
    accent: f.accent,
    vip_only: !!f.vipOnly,
    top: f.top,
    heart: f.heart,
    base: f.base,
    stock_10ml: f.stock10 ?? 0,
    stock_30ml: f.stock30 ?? 0,
    stock_50ml: f.stock50 ?? 0,
    low_stock_threshold: f.lowStock ?? 5,
  };
}

export async function adminUpsertFragrance(f: Fragrance): Promise<boolean> {
  if (!supabase) {
    demoUpsertFragrance({ ...f, id: f.id || `f_${Math.random().toString(36).slice(2, 8)}` });
    return true;
  }
  const { error } = await supabase.rpc("admin_upsert_fragrance", { p_data: toPayload(f) });
  return !error;
}

export async function adminDeleteFragrance(id: string): Promise<boolean> {
  if (!supabase) {
    demoDeleteFragrance(id);
    return true;
  }
  const { error } = await supabase.rpc("admin_delete_fragrance", { p_id: id });
  return !error;
}

export async function adminSetStock(
  id: string,
  s10: number,
  s30: number,
  s50: number,
): Promise<boolean> {
  if (!supabase) {
    demoSetStock(id, s10, s30, s50);
    return true;
  }
  const { error } = await supabase.rpc("admin_set_stock", {
    p_id: id,
    p_stock_10ml: s10,
    p_stock_30ml: s30,
    p_stock_50ml: s50,
  });
  return !error;
}

// ─── Fulfillment ─────────────────────────────────────────────────────────────

export interface AdminCommitRow {
  id: string;
  fragrance_id: string;
  size_ml: number;
  charge_cents: number | null;
  engraving: string | null;
  status: string;
  created_at: string;
}

/** All commits (admin RLS). Null when unconfigured (caller uses local state). */
export async function fetchAllCommits(): Promise<AdminCommitRow[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("commits")
      .select("id, fragrance_id, size_ml, charge_cents, engraving, status, created_at")
      .order("created_at", { ascending: false });
    if (error) return null;
    return (data ?? []) as AdminCommitRow[];
  } catch {
    return null;
  }
}

/** Australia Post consumer tracking link for a parcel article id. */
export function auspostTrackingUrl(article: string): string {
  return `https://auspost.com.au/mypost/track/details/${article}`;
}

export async function adminCreateShipment(
  commitId: string,
  carrier: string,
  trackingNumber: string,
  trackingUrl: string,
): Promise<boolean> {
  if (!supabase) return true; // demo handled via demoFulfil()
  const url =
    trackingUrl || (trackingNumber && carrier === "Australia Post" ? auspostTrackingUrl(trackingNumber) : "");
  const { error } = await supabase.rpc("admin_create_shipment", {
    p_commit_id: commitId,
    p_provider: carrier === "Australia Post" ? "auspost" : "manual",
    p_carrier: carrier || null,
    p_service: carrier === "Australia Post" ? "Parcel Post" : null,
    p_tracking_number: trackingNumber || null,
    p_tracking_url: url || null,
    p_ship_to: null,
  });
  return !error;
}

/** Demo-mode fulfillment: record a shipment against a fragrance locally. */
export function demoFulfil(fragranceId: string, ship: DemoShipment): void {
  demoSetShipment(fragranceId, ship);
}
