// Shared client-side stores for demo mode (no Supabase). They let the admin
// console mutate the catalogue and shipments in-memory so the whole flow is
// testable offline; in configured mode these are unused (data lives in the DB).

import { FRAGS, type Fragrance } from "./data";

// ─── Demo catalogue ──────────────────────────────────────────────────────────
let demoCat: Fragrance[] = FRAGS.map((f) => ({ ...f }));
const catSubs = new Set<() => void>();

export function demoFragrances(): Fragrance[] {
  return demoCat;
}
export function subscribeCatalogue(cb: () => void): () => void {
  catSubs.add(cb);
  return () => catSubs.delete(cb);
}
function emitCat() {
  for (const cb of catSubs) cb();
}

export function demoUpsertFragrance(f: Fragrance): void {
  const i = demoCat.findIndex((x) => x.id === f.id);
  demoCat = i >= 0 ? demoCat.map((x) => (x.id === f.id ? f : x)) : [...demoCat, f];
  emitCat();
}
export function demoDeleteFragrance(id: string): void {
  demoCat = demoCat.filter((x) => x.id !== id);
  emitCat();
}
export function demoSetStock(id: string, s10?: number, s30?: number, s50?: number): void {
  demoCat = demoCat.map((x) =>
    x.id === id
      ? { ...x, stock10: s10 ?? x.stock10, stock30: s30 ?? x.stock30, stock50: s50 ?? x.stock50 }
      : x,
  );
  emitCat();
}

export function demoSetOil(id: string, oilMl: number): void {
  demoCat = demoCat.map((x) => (x.id === id ? { ...x, oilMl } : x));
  emitCat();
}

// ─── Demo shipments (keyed by fragrance id — one commit per scent in demo) ────
export interface DemoShipment {
  status: "pending" | "label_created" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

let demoShip: Record<string, DemoShipment> = {};
const shipSubs = new Set<() => void>();

export function demoShipments(): Record<string, DemoShipment> {
  return demoShip;
}
export function subscribeShipments(cb: () => void): () => void {
  shipSubs.add(cb);
  return () => shipSubs.delete(cb);
}
export function demoSetShipment(fragranceId: string, ship: DemoShipment): void {
  demoShip = { ...demoShip, [fragranceId]: ship };
  for (const cb of shipSubs) cb();
}
