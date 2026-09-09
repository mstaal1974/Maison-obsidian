import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { bottleImageFor, type Fragrance, type FormatKey, type FormatStatus } from "./data";
import type { AuthUser } from "./auth";
import {
  demoUpsertFragrance,
  demoDeleteFragrance,
  demoSetStock,
  demoSetOil,
  demoSetShipment,
  demoPatchFragrance,
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
    profile: f.profile ?? [],
    // The house render is implied by the slug; only persist a real upload.
    image_url: f.imageUrl && f.imageUrl !== bottleImageFor(f.slug) ? f.imageUrl : null,
    format_prices: f.formatPrices ?? {},
    format_status: f.formatStatus ?? {},
    stock_car: f.stockCar ?? 0,
    stock_wash: f.stockWash ?? 0,
    stock_moist: f.stockMoist ?? 0,
    stock_10ml: f.stock10 ?? 0,
    stock_30ml: f.stock30 ?? 0,
    stock_50ml: f.stock50 ?? 0,
    low_stock_threshold: f.lowStock ?? 5,
  };
}

/** Upserts a fragrance and returns its id (needed to then set oil on new rows). */
export async function adminUpsertFragrance(f: Fragrance): Promise<string | null> {
  if (!supabase) {
    const id = f.id || `f_${Math.random().toString(36).slice(2, 8)}`;
    demoUpsertFragrance({ ...f, id });
    return id;
  }
  const { data, error } = await supabase.rpc("admin_upsert_fragrance", { p_data: toPayload(f) });
  return error ? null : (data as string);
}

export async function adminSetOil(id: string, oilMl: number): Promise<boolean> {
  if (!supabase) {
    demoSetOil(id, Math.max(0, oilMl));
    return true;
  }
  const { error } = await supabase.rpc("admin_set_oil", { p_id: id, p_oil_ml: Math.max(0, oilMl) });
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

// ─── Product matrix: per-format price / status / stock ───────────────────────

export interface FormatPatch {
  prices?: Partial<Record<FormatKey, number | null>>; // null clears an override
  status?: Partial<Record<FormatKey, FormatStatus>>;
  stock?: { car?: number; wash?: number; moist?: number };
}

/** Patches one fragrance's format matrix (merge semantics on the JSON maps). */
export async function adminSetFormats(id: string, patch: FormatPatch): Promise<boolean> {
  if (!supabase) {
    demoPatchFragrance(id, (f) => {
      const prices = { ...(f.formatPrices ?? {}) };
      for (const [k, v] of Object.entries(patch.prices ?? {})) {
        if (v == null) delete prices[k as FormatKey];
        else prices[k as FormatKey] = v;
      }
      return {
        ...f,
        formatPrices: prices,
        formatStatus: { ...(f.formatStatus ?? {}), ...(patch.status ?? {}) },
        stockCar: patch.stock?.car ?? f.stockCar,
        stockWash: patch.stock?.wash ?? f.stockWash,
        stockMoist: patch.stock?.moist ?? f.stockMoist,
      };
    });
    return true;
  }
  const { error } = await supabase.rpc("admin_set_formats", {
    p_id: id,
    p_prices: patch.prices ?? {},
    p_status: patch.status ?? {},
    p_stock_car: patch.stock?.car ?? null,
    p_stock_wash: patch.stock?.wash ?? null,
    p_stock_moist: patch.stock?.moist ?? null,
  });
  return !error;
}

/** Applies the same patch to every fragrance (bulk actions in the matrix). */
export async function adminSetFormatsAll(ids: string[], patch: FormatPatch): Promise<boolean> {
  const results = await Promise.all(ids.map((id) => adminSetFormats(id, patch)));
  return results.every(Boolean);
}

// ─── Fulfillment ─────────────────────────────────────────────────────────────

export interface AdminCommitRow {
  id: string;
  user_id?: string | null;
  user_email?: string | null;
  fragrance_id: string;
  format?: string | null;
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
      .select("id, user_id, user_email, fragrance_id, format, size_ml, charge_cents, engraving, status, created_at")
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

export interface CommitSizeCount {
  fragrance_id: string;
  size_ml: number;
  outstanding: number;
}

/** Outstanding commitment counts per fragrance + size. Null when unconfigured. */
export async function fetchCommitSizeCounts(): Promise<CommitSizeCount[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("commit_size_counts");
    if (error) return null;
    return (data ?? []) as CommitSizeCount[];
  } catch {
    return null;
  }
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
