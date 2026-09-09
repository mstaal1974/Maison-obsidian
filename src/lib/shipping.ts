// Australia Post postage, quoted at the bag before checkout.
//
// The customer types their postcode; the server prices the bag, measures the
// parcel and asks Australia Post what it costs. The chosen service is passed
// to checkout, where it is re-quoted server-side before the customer pays.

import type { FormatKey } from "./data";

export interface ShippingRate {
  code: string;
  name: string;
  /** What Australia Post charges. */
  priceCents: number;
  /** What the customer pays — 0 when the order earns free shipping. */
  chargeCents: number;
  etaDays?: { min: number; max: number };
}

export interface QuoteLine {
  fragranceId: string;
  format: FormatKey;
  qty: number;
  engraving: string | null;
  label?: string;
}

export interface Quote {
  rates: ShippingRate[];
  parcel: { weightKg: number; box: string };
  freeThresholdCents: number;
}

export type QuoteResult = { ok: true; data: Quote } | { ok: false; error: string } | null;

/**
 * Rates for a bag going to an Australian postcode. Null when the route isn't
 * deployed or postage isn't configured, so the bag can fall back to flat copy.
 */
export async function quoteShipping(lines: QuoteLine[], postcode: string): Promise<QuoteResult> {
  try {
    const res = await fetch("/api/shipping/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines, postcode }),
    });
    const type = res.headers.get("content-type") ?? "";
    if (res.status === 404 || res.status === 501 || !type.includes("application/json")) return null;
    const data = (await res.json()) as Quote & { error?: string };
    return res.ok ? { ok: true, data } : { ok: false, error: data.error ?? `Could not get rates (${res.status})` };
  } catch {
    return null;
  }
}

/** How an order reaches the customer, as filled in at checkout. */
export interface CheckoutDelivery {
  method: "auspost" | "alternate";
  /** Where the receipt goes, and the name on the parcel. */
  email?: string;
  name?: string;
  /** Australia Post: the address, the quoted postcode and the service picked. */
  address?: string;
  city?: string;
  region?: string;
  postcode?: string;
  code?: string;
  /** Alternate: how to reach them and how to get it to them. */
  phone?: string;
  notes?: string;
}

export function etaLabel(r: ShippingRate): string {
  if (!r.etaDays) return "";
  return r.etaDays.min === r.etaDays.max ? `${r.etaDays.min} business days` : `${r.etaDays.min}–${r.etaDays.max} business days`;
}
