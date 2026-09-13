// The staff order desk — paid orders, packing, Australia Post tracking.
//
// Everything here goes through the passphrase-gated RPCs in migration 0025.
// The passphrase is the credential: it is sent with every call and kept only in
// this tab's sessionStorage, never localStorage, so closing the tab locks the
// desk again. No serverless function is involved (the project is at Vercel's
// twelve-function ceiling), and no order data is readable through PostgREST
// without it — order_fulfilment and staff_access have RLS on and no policies.

import { supabase } from "./supabase";
import { FORMAT_BY_KEY } from "./formats";
import type { FormatKey } from "./data";

export interface StaffItem {
  fragrance_id: string;
  name: string | null;
  inspiration: string | null;
  format: FormatKey;
  size_ml: number;
  qty: number;
  engraving: string | null;
}

export interface StaffOrder {
  order_ref: string;
  placed_at: string;
  amount_cents: number;
  email: string | null;
  ship_name: string | null;
  ship_phone: string | null;
  ship_notes: string | null;
  delivery_method: string;
  ship_address: string | null;
  ship_city: string | null;
  ship_region: string | null;
  ship_postcode: string | null;
  items: StaffItem[];
  packed: boolean;
  packed_at: string | null;
  tracking_number: string | null;
  carrier: string;
  shipped_at: string | null;
}

// Both members carry both keys (one as `undefined`) because a discriminated
// union behind a generic does not narrow on `res.ok` in this project — the same
// shape scentai.ts settled on, for the same reason.
export type StaffResult<T> =
  | { ok: true; value: T; error?: undefined }
  | { ok: false; error: string; value?: undefined };

const KEY = "mo.staff.pass";
const UNKNOWN = "Something went wrong. Try again.";

export function rememberPass(pass: string): void {
  try {
    sessionStorage.setItem(KEY, pass);
  } catch {
    /* private mode — the desk still works, it just asks again on reload */
  }
}

export function recallPass(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function forgetPass(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to forget */
  }
}

/** The demo desk when Supabase isn't configured. Its passphrase is "demo". */
export const DEMO_PASS = "demo";

// ─── The sender block on a label ─────────────────────────────────────────────
// Set once at the desk and kept in this browser, because the person who prints
// is the person who knows the address, and asking them to redeploy for it is
// absurd. VITE_RETURN_ADDRESS (lines separated by "|") seeds it for a fresh
// browser; nothing is invented, and an unset address prints nothing at all
// rather than a warning on a parcel that is going out the door.
const RETURN_KEY = "mo.staff.return";

export function loadReturnAddress(): string {
  try {
    const saved = localStorage.getItem(RETURN_KEY);
    if (saved !== null) return saved;
  } catch {
    /* fall back to the build-time value */
  }
  const env = (import.meta.env.VITE_RETURN_ADDRESS as string | undefined) ?? "";
  return env.split("|").map((l) => l.trim()).filter(Boolean).join("\n");
}

export function saveReturnAddress(text: string): void {
  try {
    localStorage.setItem(RETURN_KEY, text);
  } catch {
    /* it still prints for this session */
  }
}

export function returnLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

// ─── Calls ───────────────────────────────────────────────────────────────────

/**
 * An admin needs no passphrase: staff_ok() returns true for is_admin() before
 * it looks at one, so the signed-in session is the credential. The flag only
 * matters for the demo desk, which has no session to check.
 */
export async function loadOrders(pass: string, admin = false): Promise<StaffResult<StaffOrder[]>> {
  if (!supabase) return demoLoad(pass, admin);
  const res = await call(() => supabase.rpc("staff_orders", { p_pass: pass }));
  if (!res.ok) return { ok: false, error: res.error ?? UNKNOWN };
  return { ok: true, value: (res.value ?? []) as StaffOrder[] };
}

export async function setPacked(pass: string, ref: string, packed: boolean, admin = false): Promise<StaffResult<null>> {
  if (!supabase) return demoWrite(pass, admin, ref, (o) => ({ ...o, packed, packed_at: packed ? new Date().toISOString() : null }));
  const res = await call(() => supabase.rpc("staff_set_packed", { p_pass: pass, p_order_ref: ref, p_packed: packed }));
  return res.ok ? { ok: true, value: null } : { ok: false, error: res.error ?? UNKNOWN };
}

export async function setTracking(pass: string, ref: string, tracking: string, admin = false): Promise<StaffResult<null>> {
  const clean = tracking.trim();
  if (!supabase) {
    return demoWrite(pass, admin, ref, (o) => ({
      ...o,
      tracking_number: clean || null,
      shipped_at: clean ? o.shipped_at ?? new Date().toISOString() : null,
    }));
  }
  const res = await call(() => supabase.rpc("staff_set_tracking", { p_pass: pass, p_order_ref: ref, p_tracking: clean }));
  return res.ok ? { ok: true, value: null } : { ok: false, error: res.error ?? UNKNOWN };
}

// Two failures look identical from the bench and are not: a wrong passphrase,
// and a database nobody can reach. Postgres says "not authorized" for the first
// and the browser says "Failed to fetch" for the second; neither sentence helps
// the person holding the parcel.
function friendly(message: string): string {
  if (/not authorized|insufficient/i.test(message)) return "That passphrase was not recognised.";
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Could not reach the order database. Check the connection and try again.";
  }
  return message;
}

// supabase-js reports most failures in `error`, but a dead network can throw.
// The builder it returns is a thenable rather than a Promise, hence PromiseLike.
async function call(
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<StaffResult<unknown>> {
  try {
    const { data, error } = await run();
    return error ? { ok: false, error: friendly(error.message) } : { ok: true, value: data };
  } catch (err) {
    return { ok: false, error: friendly(err instanceof Error ? err.message : String(err)) };
  }
}

// ─── Reading an order ────────────────────────────────────────────────────────

export function formatLabel(key: FormatKey, sizeMl: number): string {
  return FORMAT_BY_KEY[key]?.label ?? `${sizeMl}ml`;
}

export function itemCount(order: StaffOrder): number {
  return order.items.reduce((n, i) => n + (i.qty || 1), 0);
}

/** The address as it should appear on a label, blank lines removed. */
export function addressLines(order: StaffOrder): string[] {
  const locality = [order.ship_city, order.ship_region, order.ship_postcode].filter(Boolean).join("  ");
  return [order.ship_name, order.ship_address, locality].map((l) => (l ?? "").trim()).filter(Boolean);
}

/** Australia Post consumer tracking link for an article id. */
export function trackingUrl(article: string): string {
  return `https://auspost.com.au/mypost/track/details/${encodeURIComponent(article.trim())}`;
}

export type DeskFilter = "all" | "to_pack" | "packed" | "no_tracking";

export function matchesFilter(order: StaffOrder, filter: DeskFilter): boolean {
  switch (filter) {
    case "to_pack":
      return !order.packed;
    case "packed":
      return order.packed;
    case "no_tracking":
      return !order.tracking_number;
    default:
      return true;
  }
}

export function searchOrders(orders: StaffOrder[], query: string): StaffOrder[] {
  const q = query.trim().toLowerCase();
  if (!q) return orders;
  return orders.filter((o) =>
    [o.order_ref, o.email, o.ship_name, o.ship_postcode, o.tracking_number, ...o.items.map((i) => i.name)]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  "order_ref", "placed_at", "amount_aud", "email", "name", "phone",
  "delivery_method", "address", "city", "state", "postcode",
  "items", "packed", "tracking_number", "notes",
];

function cell(value: unknown): string {
  const s = value == null ? "" : String(value);
  // A field with a comma, a quote or a newline has to be quoted, and quotes
  // inside it doubled — delivery notes are free text and routinely contain all
  // three.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ordersCsv(orders: StaffOrder[]): string {
  const rows = orders.map((o) =>
    [
      o.order_ref,
      o.placed_at,
      (o.amount_cents / 100).toFixed(2),
      o.email,
      o.ship_name,
      o.ship_phone,
      o.delivery_method,
      o.ship_address,
      o.ship_city,
      o.ship_region,
      o.ship_postcode,
      o.items.map((i) => `${i.qty} x ${i.name ?? i.fragrance_id} ${formatLabel(i.format, i.size_ml)}`).join("; "),
      o.packed ? "yes" : "no",
      o.tracking_number,
      o.ship_notes,
    ].map(cell).join(","),
  );
  return [CSV_HEADERS.join(","), ...rows].join("\r\n");
}

export function downloadCsv(orders: StaffOrder[]): void {
  const blob = new Blob([ordersCsv(orders)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `maison-obsidian-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ─── Demo desk ───────────────────────────────────────────────────────────────
// Without Supabase the storefront runs on a seed catalogue; the desk follows
// the same rule so it can be opened, used and printed from offline. The rows
// are obviously fictional and live in this browser only.

const DEMO_KEY = "mo.staff.demo";

function demoSeed(): StaffOrder[] {
  const day = 86_400_000;
  const now = Date.now();
  return [
    {
      order_ref: "cs_demo_a1",
      placed_at: new Date(now - day).toISOString(),
      amount_cents: 6020,
      email: "demo.customer@example.com",
      ship_name: "Demo Customer",
      ship_phone: "0400 000 000",
      ship_notes: null,
      delivery_method: "auspost",
      ship_address: "PO Box 793",
      ship_city: "Tugun",
      ship_region: "QLD",
      ship_postcode: "4224",
      items: [
        { fragrance_id: "f1", name: "Smoky Obsidian", inspiration: "Inspired by Tom Ford - Black Lacquer", format: "perf10", size_ml: 10, qty: 2, engraving: null },
        { fragrance_id: "f4", name: "Golden Aura", inspiration: "Inspired by Burberry - Goddess", format: "perf10", size_ml: 10, qty: 3, engraving: null },
      ],
      packed: false,
      packed_at: null,
      tracking_number: null,
      carrier: "Australia Post",
      shipped_at: null,
    },
    {
      order_ref: "cs_demo_a2",
      placed_at: new Date(now - 3 * day).toISOString(),
      amount_cents: 12000,
      email: "second.demo@example.com",
      ship_name: "Second Demo",
      ship_phone: null,
      ship_notes: "Leave with the neighbour at number 14.",
      delivery_method: "alternate",
      ship_address: "14 Sample Street",
      ship_city: "Burleigh Heads",
      ship_region: "QLD",
      ship_postcode: "4220",
      items: [{ fragrance_id: "f2", name: "Velvet Absolute", inspiration: "Inspired by YSL - MYSLF L'Absolu", format: "perf50", size_ml: 50, qty: 1, engraving: "For M." }],
      packed: true,
      packed_at: new Date(now - 2 * day).toISOString(),
      tracking_number: "33DEMO0001234",
      carrier: "Australia Post",
      shipped_at: new Date(now - 2 * day).toISOString(),
    },
  ];
}

function demoRead(): StaffOrder[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw) as StaffOrder[];
  } catch {
    /* fall through to the seed */
  }
  return demoSeed();
}

function demoWriteAll(orders: StaffOrder[]): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(orders));
  } catch {
    /* the desk still shows the change for this session */
  }
}

function demoLoad(pass: string, admin: boolean): StaffResult<StaffOrder[]> {
  if (!admin && pass !== DEMO_PASS) return { ok: false, error: "That passphrase was not recognised." };
  return { ok: true, value: demoRead() };
}

function demoWrite(pass: string, admin: boolean, ref: string, change: (o: StaffOrder) => StaffOrder): StaffResult<null> {
  if (!admin && pass !== DEMO_PASS) return { ok: false, error: "That passphrase was not recognised." };
  demoWriteAll(demoRead().map((o) => (o.order_ref === ref ? change(o) : o)));
  return { ok: true, value: null };
}
