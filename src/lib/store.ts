import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { type Fragrance, FRAGS } from "./data";
import { supabase, type FragranceRow } from "./supabase";
import { demoFragrances, subscribeCatalogue } from "./catalogue";

type Source = "seed" | "supabase";

function rowToFragrance(r: FragranceRow): Fragrance {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    inspiration: r.inspiration,
    tagline: r.tagline,
    story: r.story,
    price: r.price_50ml_cents,
    price10: r.price_10ml_cents,
    price30: r.price_30ml_cents,
    gender: r.gender,
    moq: r.moq,
    committed: r.committed,
    liquid: r.liquid,
    accent: r.accent,
    vipOnly: r.vip_only,
    top: r.top ?? [],
    heart: r.heart ?? [],
    base: r.base ?? [],
    stock10: r.stock_10ml,
    stock30: r.stock_30ml,
    stock50: r.stock_50ml,
    lowStock: r.low_stock_threshold,
    oilMl: r.oil_ml,
    imageUrl: r.image_url ?? undefined,
    profile: r.profile ?? [],
  };
}

/**
 * Returns the catalogue. Renders the seed data immediately (no loading flash),
 * then swaps in live rows — including up-to-date `committed` counts — once
 * Supabase responds. Falls back to seed on any error or when unconfigured.
 */
export function useFragrances() {
  const [remote, setRemote] = useState<Fragrance[] | null>(null);
  const [source, setSource] = useState<Source>(supabase ? "supabase" : "seed");
  // In demo mode the catalogue is a mutable in-memory store (admin edits it).
  const demo = useSyncExternalStore(subscribeCatalogue, demoFragrances);

  const reload = useCallback(() => {
    if (!supabase) return;
    void supabase
      .from("fragrances")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) return;
        setRemote((data as FragranceRow[]).map(rowToFragrance));
        setSource("supabase");
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const fragrances = supabase ? remote ?? FRAGS : demo;
  return { fragrances, source, reload };
}

/**
 * Records a batch commit in Supabase via the atomic `commit_to_batch` RPC,
 * including the chosen bottle size and the price held for it. No-ops when
 * Supabase isn't configured (the UI already tracks commits locally and
 * persists them to localStorage). Errors are swallowed so a backend hiccup
 * never blocks the optimistic UI.
 */
export async function recordCommit(
  fragranceId: string,
  engraving: string | null,
  sizeMl: number,
  chargeCents: number,
  paymentIntentId: string | null,
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.rpc("commit_to_batch", {
      p_fragrance_id: fragranceId,
      p_engraving: engraving,
      p_size_ml: sizeMl,
      p_charge_cents: chargeCents,
      p_payment_intent_id: paymentIntentId,
    });
  } catch {
    /* offline / RLS / network — optimistic UI already reflects the commit */
  }
}

export interface CommitRow {
  fragrance_id: string;
  engraving: string | null;
  size_ml: number;
  charge_cents: number | null;
  status: "authorized" | "captured" | "released" | "void";
  created_at: string;
}

/**
 * Fetches the signed-in user's commits (RLS restricts rows to their own).
 * Returns null when Supabase isn't configured so callers use local state.
 */
export async function fetchMyCommits(userId: string): Promise<CommitRow[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("commits")
      .select("fragrance_id, engraving, size_ml, charge_cents, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return null;
    return (data ?? []) as CommitRow[];
  } catch {
    return null;
  }
}

export interface ShipmentRow {
  fragrance_id: string | null;
  status: "pending" | "label_created" | "shipped" | "delivered" | "cancelled";
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
}

/** Fetches the signed-in user's shipments (RLS-scoped). Null when unconfigured. */
export async function fetchMyShipments(userId: string): Promise<ShipmentRow[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("shipments")
      .select("fragrance_id, status, carrier, tracking_number, tracking_url")
      .eq("user_id", userId);
    if (error) return null;
    return (data ?? []) as ShipmentRow[];
  } catch {
    return null;
  }
}

/**
 * Returns true if the signed-in user already holds a VIP subscription. No-ops
 * to false when Supabase isn't configured (demo membership is tracked locally).
 */
export async function isVipSubscriber(userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase
      .from("subscribers")
      .select("tier")
      .eq("user_id", userId)
      .eq("tier", "vip")
      .maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Enrols an email address in the VIP club via the `enroll_subscriber` RPC.
 * No-ops (returns true) when Supabase isn't configured so the demo still
 * unlocks locally; returns false only when a configured backend rejects it.
 */
export async function enrollVip(email: string): Promise<boolean> {
  if (!supabase) return true;
  try {
    const { error } = await supabase.rpc("enroll_subscriber", {
      p_email: email,
      p_tier: "vip",
    });
    return !error;
  } catch {
    return false;
  }
}
