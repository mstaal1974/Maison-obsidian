// The bag: format-level lines persisted to localStorage, plus the orders the
// visitor has placed (each line becomes an order row, paid at checkout). A tiny
// external store so any component can subscribe with useSyncExternalStore.

import type { FormatKey } from "./data";
import { DISCOVERY_BOX_PRICE, DISCOVERY_BOX_SIZE } from "./formats";

export interface BagLine {
  id: string; // `${fragranceId}:${format}` (or `${fragranceId}:${format}:box` for a Discovery Box piece)
  fragranceId: string;
  format: FormatKey;
  qty: number;
  engraving: string | null;
  /** Price override in cents — Discovery Box pieces are priced as a set. */
  unitPrice?: number;
  label?: string; // e.g. "Discovery Box"
}

export interface Order {
  id: string;
  fragranceId: string;
  format: FormatKey;
  sizeMl: number;
  qty: number;
  chargeCents: number; // per unit
  engraving: string | null;
  createdAt: number;
}

const BAG_KEY = "mo:bag";
const ORDERS_KEY = "mo:orders";
const LEGACY_KEY = "mo:commits"; // pre-redesign single-commit map

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* quota / private mode */
  }
}

/** Migrates the old {fragranceId: {label,sizeMl,chargeCents}} map into orders. */
function loadOrders(): Order[] {
  const orders = load<Order[]>(ORDERS_KEY, []);
  const legacy = load<Record<string, { label: string | null; sizeMl?: number; chargeCents?: number }> | null>(LEGACY_KEY, null);
  if (!legacy) return orders;
  const migrated: Order[] = Object.entries(legacy).map(([fragranceId, rec]) => ({
    id: `legacy:${fragranceId}`,
    fragranceId,
    format: rec.sizeMl === 10 ? "perf10" : rec.sizeMl === 30 ? "perf30" : "perf50",
    sizeMl: rec.sizeMl ?? 50,
    qty: 1,
    chargeCents: rec.chargeCents ?? 0,
    engraving: rec.label,
    createdAt: 0,
  }));
  const all = [...orders, ...migrated.filter((m) => !orders.some((o) => o.id === m.id))];
  save(ORDERS_KEY, all);
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
  return all;
}

export const DISCOVERY_LABEL = "Discovery Box";
const BOX_UNIT = Math.round(DISCOVERY_BOX_PRICE / DISCOVERY_BOX_SIZE);

/**
 * Any five 10 ml bottles in the bag are a Discovery Box, however they were
 * added: from the Discovery page's builder, or one at a time from product
 * pages. After every change the 10 ml bottles are regrouped so that every
 * complete five is priced as a box ($50 the set) and the rest at the single
 * price — and a box can never be left incomplete (checkout only accepts boxes
 * in complete fives; api/_lib/stripe.ts). Bottles already in a box stay in it
 * first, so taking one out never shuffles which others count. An engraved 10 ml
 * is a personalised bottle, so it stays out of boxes.
 */
function regroup(input: BagLine[]): BagLine[] {
  const pooled = (l: BagLine) => l.format === "perf10" && !l.engraving;
  const pool = input.filter(pooled);
  const total = pool.reduce((n, l) => n + l.qty, 0);
  let boxed = Math.floor(total / DISCOVERY_BOX_SIZE) * DISCOVERY_BOX_SIZE;
  // Each fragrance's 10 ml bottles: how many are boxed now, and in all.
  const per = new Map<string, { boxed: number; all: number }>();
  for (const l of pool) {
    const p = per.get(l.fragranceId) ?? { boxed: 0, all: 0 };
    p.all += l.qty;
    if (l.label === DISCOVERY_LABEL) p.boxed += l.qty;
    per.set(l.fragranceId, p);
  }
  // Fill the boxes: bottles already boxed first, then singles, in bag order.
  const take = new Map<string, number>();
  for (const pass of ["boxed", "single"] as const) {
    for (const [id, p] of per) {
      if (!boxed) break;
      const have = take.get(id) ?? 0;
      const want = pass === "boxed" ? Math.min(p.boxed, p.all) : p.all - have;
      const n = Math.min(want, boxed);
      take.set(id, have + n);
      boxed -= n;
    }
  }
  const out: BagLine[] = [];
  const done = new Set<string>();
  for (const l of input) {
    if (!pooled(l)) {
      out.push(l);
      continue;
    }
    if (done.has(l.fragranceId)) continue;
    done.add(l.fragranceId);
    const p = per.get(l.fragranceId)!;
    const inBox = take.get(l.fragranceId) ?? 0;
    if (inBox) out.push({ id: `${l.fragranceId}:perf10:box`, fragranceId: l.fragranceId, format: "perf10", qty: inBox, engraving: null, unitPrice: BOX_UNIT, label: DISCOVERY_LABEL });
    if (p.all - inBox) out.push({ id: `${l.fragranceId}:perf10`, fragranceId: l.fragranceId, format: "perf10", qty: p.all - inBox, engraving: null });
  }
  return out;
}

/** How the bag's 10 ml bottles stand against the Discovery Box: complete boxes, and loose bottles. */
export function discoveryProgress(bag: BagLine[]): { boxes: number; loose: number; toNext: number } {
  const boxedUnits = bag.filter((l) => l.label === DISCOVERY_LABEL).reduce((n, l) => n + l.qty, 0);
  const loose = bag.filter((l) => l.format === "perf10" && !l.engraving && l.label !== DISCOVERY_LABEL).reduce((n, l) => n + l.qty, 0);
  return { boxes: Math.floor(boxedUnits / DISCOVERY_BOX_SIZE), loose, toNext: DISCOVERY_BOX_SIZE - (loose % DISCOVERY_BOX_SIZE) };
}

let lines: BagLine[] = regroup(load<BagLine[]>(BAG_KEY, []));
let orders: Order[] = loadOrders();
const subs = new Set<() => void>();
function emit() {
  for (const cb of subs) cb();
}

export function subscribeBag(cb: () => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}
export function bagLines(): BagLine[] {
  return lines;
}
export function bagOrders(): Order[] {
  return orders;
}

export function addToBag(
  fragranceId: string,
  format: FormatKey,
  qty = 1,
  engraving: string | null = null,
  extra?: { unitPrice?: number; label?: string },
): void {
  const id = `${fragranceId}:${format}${extra?.label ? ":box" : ""}`;
  const existing = lines.find((l) => l.id === id);
  lines = regroup(
    existing
      ? lines.map((l) => (l.id === id ? { ...l, qty: Math.min(9, l.qty + qty), engraving: engraving ?? l.engraving } : l))
      : [...lines, { id, fragranceId, format, qty, engraving, ...extra }],
  );
  save(BAG_KEY, lines);
  emit();
}

export function setQty(id: string, qty: number): void {
  lines = regroup(qty <= 0 ? lines.filter((l) => l.id !== id) : lines.map((l) => (l.id === id ? { ...l, qty: Math.min(9, qty) } : l)));
  save(BAG_KEY, lines);
  emit();
}

export function removeLine(id: string): void {
  setQty(id, 0);
}

export function clearBag(): void {
  lines = [];
  save(BAG_KEY, lines);
  emit();
}

export function bagCount(): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

/** Moves the bag into orders (called after each line is authorised). */
export function recordOrders(placed: Omit<Order, "id" | "createdAt">[]): Order[] {
  const now = Date.now();
  const created = placed.map((p, i) => ({ ...p, id: `o_${now.toString(36)}_${i}`, createdAt: now }));
  orders = [...created, ...orders];
  save(ORDERS_KEY, orders);
  lines = [];
  save(BAG_KEY, lines);
  emit();
  return created;
}

/** Local orders for a fragrance (used to bump batch progress optimistically). */
export function ordersFor(fragranceId: string): number {
  return orders.filter((o) => o.fragranceId === fragranceId).reduce((n, o) => n + o.qty, 0);
}

// ─── Discovery box: pick five 10 ml scents ───────────────────────────────────
const DISCOVERY_KEY = "mo:discovery";
let discovery: string[] = load<string[]>(DISCOVERY_KEY, []);

export function discoveryIds(): string[] {
  return discovery;
}
export function toggleDiscovery(fragranceId: string, max: number): boolean {
  if (discovery.includes(fragranceId)) discovery = discovery.filter((x) => x !== fragranceId);
  else if (discovery.length < max) discovery = [...discovery, fragranceId];
  else return false;
  save(DISCOVERY_KEY, discovery);
  emit();
  return true;
}
export function clearDiscovery(): void {
  discovery = [];
  save(DISCOVERY_KEY, discovery);
  emit();
}
