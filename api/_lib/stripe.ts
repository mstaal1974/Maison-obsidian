// Shared server-side helpers for the Stripe routes. Files under api/_lib are
// not deployed as functions (Vercel ignores underscore-prefixed paths).
//
// Env (Vercel → Project → Settings → Environment Variables):
//   STRIPE_SECRET_KEY          sk_live_… / sk_test_…      — required for every route
//   STRIPE_WEBHOOK_SECRET      whsec_…                    — required by /api/stripe/webhook
//   SUPABASE_SERVICE_ROLE_KEY  service role JWT           — webhook + capture write with it
//   SUPABASE_URL / VITE_SUPABASE_URL, SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY
//   SITE_URL                   https://maison-obsidian.vercel.app (redirect target; falls back to the request host)
//   STRIPE_CURRENCY            aud (default)

import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type CatalogueItem, type FormatKey, FORMAT_BY_KEY, buyable, formatPrice, subscriptionPrice, DISCOVERY_BOX_PRICE, DISCOVERY_BOX_SIZE } from "./catalogue.js";

export const CURRENCY = (process.env.STRIPE_CURRENCY ?? "aud").toLowerCase();

// Pinned so the shape of every response (invoices especially) changes only
// when this line does, not when the SDK is bumped. Keep it in step with the
// version the installed `stripe` package was built for.
export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key, { apiVersion: STRIPE_API_VERSION }) : null;
}

export function supabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
}
function anonKey(): string | undefined {
  return process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
}

/** Service-role client: bypasses RLS. Only the webhook and admin routes use it. */
export function serviceClient(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

/** The signed-in customer behind a request's bearer token, or null. */
export async function userFromRequest(req: any): Promise<{ id: string; email: string | null; token: string } | null> {
  const url = supabaseUrl();
  const anon = anonKey();
  const auth = String(req.headers["authorization"] ?? "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!url || !anon || !token) return null;
  try {
    const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null, token };
  } catch {
    return null;
  }
}

/** True when the bearer token belongs to an admin (is_admin RPC). */
export async function isAdminRequest(req: any): Promise<boolean> {
  const url = supabaseUrl();
  const anon = anonKey();
  const auth = String(req.headers["authorization"] ?? "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!url || !anon || !token) return false;
  try {
    const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.rpc("is_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Where Checkout sends the customer back: SITE_URL, else the request's own host. */
export function siteUrl(req: any): string {
  const env = process.env.SITE_URL?.replace(/\/+$/, "");
  if (env) return env;
  const proto = String(req.headers["x-forwarded-proto"] ?? "https").split(",")[0];
  const host = String(req.headers["x-forwarded-host"] ?? req.headers["host"] ?? "");
  return `${proto}://${host}`;
}

export function readBody(req: any): Record<string, any> {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
}

/**
 * Raw request bytes, for Stripe signature verification. The stream is read
 * first, before anything touches `req.body`: on Vercel that getter parses the
 * JSON, and bytes re-serialised from a parsed object no longer match the
 * signature. Returns null when only a parsed body is left, so the webhook can
 * say so rather than report a bad signature.
 */
export async function rawBody(req: any): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  if (!req.readableEnded) {
    for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  }
  if (chunks.length) return Buffer.concat(chunks);
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  return null;
}

// ─── Catalogue: prices are computed here, never trusted from the browser ─────

interface FragranceRow {
  id: string;
  slug: string;
  name: string;
  price_10ml_cents: number;
  price_30ml_cents: number;
  price_50ml_cents: number;
  vip_only: boolean;
  stock_10ml: number | null;
  stock_30ml: number | null;
  stock_50ml: number | null;
  stock_car: number | null;
  stock_wash: number | null;
  stock_moist: number | null;
  format_prices: Record<string, number> | null;
  format_status: Record<string, string> | null;
  launch_at: string | null;
}

function rowToItem(r: FragranceRow): CatalogueItem {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    price: r.price_50ml_cents,
    price10: r.price_10ml_cents,
    price30: r.price_30ml_cents,
    vipOnly: r.vip_only,
    stock10: r.stock_10ml ?? 0,
    stock30: r.stock_30ml ?? 0,
    stock50: r.stock_50ml ?? 0,
    stockCar: r.stock_car ?? 0,
    stockWash: r.stock_wash ?? 0,
    stockMoist: r.stock_moist ?? 0,
    formatPrices: (r.format_prices ?? undefined) as CatalogueItem["formatPrices"],
    formatStatus: (r.format_status ?? undefined) as CatalogueItem["formatStatus"],
    launchAt: r.launch_at,
  };
}

const FRAG_SELECT = "id, slug, name, price_10ml_cents, price_30ml_cents, price_50ml_cents, vip_only, stock_10ml, stock_30ml, stock_50ml, stock_car, stock_wash, stock_moist, format_prices, format_status, launch_at";

/** Live catalogue (public read, anon key is enough). */
export async function loadCatalogue(): Promise<Map<string, CatalogueItem>> {
  const url = supabaseUrl();
  const anon = anonKey();
  if (!url || !anon) return new Map();
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await sb.from("fragrances").select(FRAG_SELECT);
  return new Map(((data ?? []) as FragranceRow[]).map((r) => [r.id, rowToItem(r)]));
}

export interface CheckoutLine {
  fragranceId: string;
  format: FormatKey;
  qty: number;
  engraving: string | null;
  /** Discovery Box pieces are priced as a set. */
  label?: string;
}

export interface PricedLine extends CheckoutLine {
  name: string;
  formatName: string;
  sizeMl: number;
  unitCents: number;
}

/** Validates and prices the bag server-side. Throws on anything not buyable. */
export function priceLines(lines: CheckoutLine[], catalogue: Map<string, CatalogueItem>): PricedLine[] {
  if (!Array.isArray(lines) || !lines.length || lines.length > 100) throw new Error("Invalid bag size");
  for (const l of lines) {
    if (!l || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 20) throw new Error("Quantity must be between 1 and 20");
    if (l.engraving != null && typeof l.engraving !== "string") throw new Error("Invalid engraving");
    if (l.label && l.label !== "Discovery Box") throw new Error("Invalid bundle");
    if (l.label === "Discovery Box" && l.format !== "perf10") throw new Error("Discovery Boxes contain only 10 ml fragrances");
  }
  const boxPieces = lines.filter((l) => l.label === "Discovery Box" && l.format === "perf10").reduce((n, l) => n + l.qty, 0);
  const boxPriced = boxPieces > 0 && boxPieces % DISCOVERY_BOX_SIZE === 0;
  if (boxPieces && !boxPriced) throw new Error("Discovery Boxes must contain complete sets of five");
  return lines.map((l) => {
    const f = catalogue.get(l.fragranceId);
    if (!f) throw new Error(`unknown fragrance ${l.fragranceId}`);
    const def = FORMAT_BY_KEY[l.format];
    if (!def) throw new Error(`unknown format ${l.format}`);
    if (!buyable(f, l.format)) throw new Error(`${f.name} ${def.name} is not available`);
    const qty = Math.max(1, Math.min(20, Math.floor(l.qty || 1)));
    const unit = l.format === "perf10" && l.label === "Discovery Box" && boxPriced ? Math.round(DISCOVERY_BOX_PRICE / DISCOVERY_BOX_SIZE) : formatPrice(f, l.format);
    return { ...l, qty, engraving: l.engraving?.trim().slice(0, 28) || null, name: f.name, formatName: def.name, sizeMl: def.sizeMl, unitCents: unit };
  });
}

export function memberPrice(f: CatalogueItem, format: FormatKey): number {
  return subscriptionPrice(f, format);
}

// ─── Stripe customer per account ─────────────────────────────────────────────
export async function customerFor(stripe: Stripe, db: SupabaseClient, user: { id: string; email: string | null }): Promise<string> {
  const { data } = await db.from("stripe_customers").select("customer_id").eq("user_id", user.id).maybeSingle();
  if (data?.customer_id) return data.customer_id as string;
  const customer = await stripe.customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id } });
  await db.from("stripe_customers").upsert({ user_id: user.id, customer_id: customer.id, email: user.email });
  return customer.id;
}

/**
 * Names the environment variables a route needs and can't see, so a 501 says
 * exactly what to set in Vercel rather than just "not configured".
 */
export function missingConfig(need: ("stripe" | "service" | "webhook")[]): string[] {
  const missing: string[] = [];
  if (need.includes("stripe") && !process.env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
  if (need.includes("service")) {
    if (!supabaseUrl()) missing.push("SUPABASE_URL (or VITE_SUPABASE_URL)");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (need.includes("webhook") && !process.env.STRIPE_WEBHOOK_SECRET) missing.push("STRIPE_WEBHOOK_SECRET");
  return missing;
}

/** The standard 501 for an unconfigured route, naming what's missing. */
export function notConfigured(res: any, what: string, need: ("stripe" | "service" | "webhook")[]) {
  const missing = missingConfig(need);
  return json(res, 501, { error: `${what} isn't configured`, detail: missing.length ? `Missing in Vercel: ${missing.join(", ")}` : "Keys are set but the client could not start", missing });
}

export function json(res: any, status: number, body: unknown) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

/**
 * Wraps a route so an exception (a Stripe rejection, a missing table, a
 * misconfigured key) comes back as JSON naming the cause, rather than
 * Vercel's plain-text FUNCTION_INVOCATION_FAILED page the app can't read.
 * `detail` (Stripe's error type, code and message) goes to admins only;
 * everyone else gets `error`, and the full error is in the function logs.
 */
export function route(name: string, handler: (req: any, res: any) => Promise<unknown>) {
  return async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (e) {
      const err = e as { message?: string; type?: string; code?: string; statusCode?: number };
      console.error(`[stripe/${name}]`, e);
      if (res.headersSent) return;
      const body: { error: string; detail?: string } = { error: "Checkout could not start" };
      if (await isAdminRequest(req)) body.detail = `${name}: ${[err.type, err.code, err.message].filter(Boolean).join(" · ") || "unknown error"}`;
      json(res, 500, body);
    }
  };
}
