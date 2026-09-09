// ─── The Monthly Pour: a 12-month fragrance subscription ─────────────────────
//
// The customer picks a format (10 / 30 / 50 ml perfume or the car diffuser),
// commits to twelve monthly payments, and receives one fragrance a month at
// 10% under that month's shelf price. They choose the upcoming scent from
// their account. Each billed month becomes a delivery.
//
// Storage mirrors the rest of the app: Supabase RPCs when configured (see
// migration 0012), a localStorage store in demo mode so the whole flow works
// without a backend.

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Fragrance, FormatKey } from "./data";
import { formatPrice, FORMAT_BY_KEY } from "./formats";
import { supabase } from "./supabase";

export const SUBSCRIPTION_FORMATS: FormatKey[] = ["perf10", "perf30", "perf50", "car"];
export const SUBSCRIPTION_MONTHS = 12;
export const SUBSCRIPTION_DISCOUNT = 0.1;

export type SubscriptionStatus = "active" | "cancelled" | "completed";
export type DeliveryStatus = "paid" | "shipped" | "delivered";

export interface Delivery {
  id: string;
  month: number; // 1-based
  fragranceId: string;
  chargeCents: number;
  status: DeliveryStatus;
  billedAt: string; // ISO
}

export interface Subscription {
  id: string;
  userEmail: string | null;
  format: FormatKey;
  months: number;
  status: SubscriptionStatus;
  nextFragranceId: string | null;
  startedAt: string; // ISO
  deliveries: Delivery[];
}

/** Member price for one month: 10% under the format's shelf price, rounded to the cent. */
export function subscriptionPrice(f: Fragrance, key: FormatKey): number {
  return Math.round(formatPrice(f, key) * (1 - SUBSCRIPTION_DISCOUNT));
}

/** Lowest member price across the catalogue for a format — the "from" figure. */
export function subscriptionFrom(frags: Fragrance[], key: FormatKey): number {
  const prices = frags.map((f) => subscriptionPrice(f, key));
  return prices.length ? Math.min(...prices) : 0;
}

export function monthsBilled(s: Subscription): number {
  return s.deliveries.length;
}

/** The month the next charge would be, or null once the term is complete. */
export function nextMonth(s: Subscription): number | null {
  const n = monthsBilled(s) + 1;
  return s.status === "active" && n <= s.months ? n : null;
}

/** Next billing date: the same day-of-month as the start, N months on. */
export function nextBillingDate(s: Subscription): Date | null {
  const n = nextMonth(s);
  if (n === null) return null;
  const d = new Date(s.startedAt);
  d.setMonth(d.getMonth() + (n - 1));
  return d;
}

export function subscriptionLabel(s: Subscription): string {
  return FORMAT_BY_KEY[s.format].name;
}

// ─── Demo store (no Supabase) ────────────────────────────────────────────────
const DEMO_KEY = "mo:subscriptions";
let demoRows: Subscription[] | null = null;
const listeners = new Set<() => void>();

function loadDemo(): Subscription[] {
  if (demoRows) return demoRows;
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    demoRows = raw ? (JSON.parse(raw) as Subscription[]) : [];
  } catch {
    demoRows = [];
  }
  return demoRows;
}

function saveDemo(rows: Subscription[]) {
  demoRows = rows;
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
  } catch {
    /* private mode — keep the in-memory copy */
  }
  listeners.forEach((l) => l());
}

function subscribeDemo(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const uid = () => `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ─── Row mapping (Supabase) ──────────────────────────────────────────────────
interface SubRow {
  id: string;
  user_email: string | null;
  format: FormatKey;
  months: number;
  status: SubscriptionStatus;
  next_fragrance_id: string | null;
  started_at: string;
  subscription_deliveries?: DeliveryRow[];
}
interface DeliveryRow {
  id: string;
  month: number;
  fragrance_id: string;
  charge_cents: number;
  status: DeliveryStatus;
  billed_at: string;
}

function rowToSub(r: SubRow): Subscription {
  return {
    id: r.id,
    userEmail: r.user_email,
    format: r.format,
    months: r.months,
    status: r.status,
    nextFragranceId: r.next_fragrance_id,
    startedAt: r.started_at,
    deliveries: (r.subscription_deliveries ?? [])
      .map((d) => ({ id: d.id, month: d.month, fragranceId: d.fragrance_id, chargeCents: d.charge_cents, status: d.status, billedAt: d.billed_at }))
      .sort((a, b) => a.month - b.month),
  };
}

const SELECT = "id, user_email, format, months, status, next_fragrance_id, started_at, subscription_deliveries(id, month, fragrance_id, charge_cents, status, billed_at)";

// ─── Public API ──────────────────────────────────────────────────────────────

export interface StartResult {
  ok: boolean;
  error?: string;
}

/**
 * Starts a subscription with the first month paid. `chargeCents` is the
 * member price of the first pick; `paymentIntentId` is whatever the processor
 * returned (or the stub). One active subscription per customer.
 */
export async function startSubscription(
  format: FormatKey,
  fragranceId: string,
  chargeCents: number,
  paymentIntentId: string | null,
  userEmail: string | null,
): Promise<StartResult> {
  if (!supabase) {
    const rows = loadDemo();
    if (rows.some((s) => s.status === "active")) return { ok: false, error: "You already have an active subscription." };
    const now = new Date().toISOString();
    saveDemo([
      {
        id: uid(),
        userEmail,
        format,
        months: SUBSCRIPTION_MONTHS,
        status: "active",
        nextFragranceId: fragranceId,
        startedAt: now,
        deliveries: [{ id: uid(), month: 1, fragranceId, chargeCents, status: "paid", billedAt: now }],
      },
      ...rows,
    ]);
    return { ok: true };
  }
  try {
    const { error } = await supabase.rpc("start_subscription", {
      p_format: format,
      p_fragrance_id: fragranceId,
      p_charge_cents: chargeCents,
      p_payment_intent_id: paymentIntentId,
      p_months: SUBSCRIPTION_MONTHS,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not start the subscription." };
  }
}

export async function setSubscriptionPick(id: string, fragranceId: string): Promise<boolean> {
  if (!supabase) {
    saveDemo(loadDemo().map((s) => (s.id === id ? { ...s, nextFragranceId: fragranceId } : s)));
    return true;
  }
  try {
    const { error } = await supabase.rpc("set_subscription_pick", { p_id: id, p_fragrance_id: fragranceId });
    return !error;
  } catch {
    return false;
  }
}

export async function cancelSubscription(id: string): Promise<boolean> {
  if (!supabase) {
    saveDemo(loadDemo().map((s) => (s.id === id ? { ...s, status: "cancelled" } : s)));
    return true;
  }
  try {
    const { error } = await supabase.rpc("cancel_subscription", { p_id: id });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Records the next month's charge as a delivery. In production the payment
 * processor's monthly charge (Stripe Subscriptions webhook or a scheduled
 * job) calls the same RPC; the admin console calls it by hand.
 */
export async function billSubscriptionMonth(id: string, chargeCents: number, paymentIntentId: string | null): Promise<boolean> {
  if (!supabase) {
    saveDemo(
      loadDemo().map((s) => {
        if (s.id !== id || s.status !== "active" || !s.nextFragranceId) return s;
        const month = s.deliveries.length + 1;
        if (month > s.months) return s;
        const deliveries = [...s.deliveries, { id: uid(), month, fragranceId: s.nextFragranceId, chargeCents, status: "paid" as const, billedAt: new Date().toISOString() }];
        return { ...s, deliveries, status: month === s.months ? "completed" : "active" };
      }),
    );
    return true;
  }
  try {
    const { error } = await supabase.rpc("bill_subscription_month", { p_id: id, p_charge_cents: chargeCents, p_payment_intent_id: paymentIntentId });
    return !error;
  } catch {
    return false;
  }
}

export async function setDeliveryStatus(deliveryId: string, status: DeliveryStatus): Promise<boolean> {
  if (!supabase) {
    saveDemo(loadDemo().map((s) => ({ ...s, deliveries: s.deliveries.map((d) => (d.id === deliveryId ? { ...d, status } : d)) })));
    return true;
  }
  try {
    const { error } = await supabase.from("subscription_deliveries").update({ status }).eq("id", deliveryId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * The signed-in customer's subscriptions (RLS limits rows to their own), or
 * every subscription for an admin. Demo mode reads the local store.
 */
export function useSubscriptions(enabled: boolean) {
  const demo = useSyncExternalStore(subscribeDemo, loadDemo, () => []);
  const [remote, setRemote] = useState<Subscription[] | null>(null);

  const reload = useCallback(() => {
    if (!supabase || !enabled) return;
    void supabase
      .from("scent_subscriptions")
      .select(SELECT)
      .order("started_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setRemote((data as unknown as SubRow[]).map(rowToSub));
      });
  }, [enabled]);

  useEffect(() => reload(), [reload]);

  const subscriptions = supabase ? (remote ?? []) : demo;
  return { subscriptions, loading: !!supabase && enabled && remote === null, reload };
}
