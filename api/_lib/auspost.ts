// Australia Post domestic postage rates.
//
// Uses the Postage Assessment Calculator's service listing, which returns the
// services available for a parcel of a given size and weight along with each
// price:
//   GET https://digitalapi.auspost.com.au/postage/parcel/domestic/service.json
//       ?from_postcode=&to_postcode=&length=&width=&height=&weight=
//       header: AUTH-KEY: <AUSPOST_PAC_KEY>
//
// Env (Vercel → Settings → Environment Variables):
//   AUSPOST_PAC_KEY        the PAC API key — server only, never VITE_
//   AUSPOST_FROM_POSTCODE  where you post from (e.g. 6000)

import type { Parcel } from "./parcel.js";

const PAC_BASE = "https://digitalapi.auspost.com.au/postage/parcel/domestic";

export interface ShippingRate {
  code: string; // e.g. AUS_PARCEL_REGULAR
  name: string; // e.g. Parcel Post
  priceCents: number; // what Australia Post charges
  /** What the customer pays — 0 when the order earns free shipping. */
  chargeCents: number;
  etaDays?: { min: number; max: number };
}

export function auspostConfigured(): boolean {
  return !!process.env.AUSPOST_PAC_KEY && !!process.env.AUSPOST_FROM_POSTCODE;
}

/** Orders at or above this subtotal ship standard for free. */
export const FREE_SHIPPING_THRESHOLD_CENTS = 10000;

/** Delivery estimates AusPost doesn't return on this endpoint. */
const ETA: Record<string, { min: number; max: number }> = {
  AUS_PARCEL_REGULAR: { min: 2, max: 6 },
  AUS_PARCEL_EXPRESS: { min: 1, max: 3 },
};

const CODE_ORDER = ["AUS_PARCEL_REGULAR", "AUS_PARCEL_EXPRESS"];

interface PacService {
  code?: string;
  name?: string;
  price?: string | number;
}

/**
 * Live rates for a parcel to an Australian postcode, cheapest first. Only the
 * standard and express parcel services are offered; anything else AusPost
 * lists (couriers, satchels priced by pre-paid product) is filtered out.
 * Throws with a readable message when AusPost rejects the request.
 */
export async function quoteRates(parcel: Parcel, toPostcode: string, subtotalCents: number): Promise<ShippingRate[]> {
  const key = process.env.AUSPOST_PAC_KEY;
  const from = process.env.AUSPOST_FROM_POSTCODE;
  if (!key || !from) throw new Error("Australia Post is not configured");

  const qs = new URLSearchParams({
    from_postcode: from,
    to_postcode: toPostcode,
    length: String(parcel.lengthCm),
    width: String(parcel.widthCm),
    height: String(parcel.heightCm),
    weight: String(parcel.weightKg),
  });
  const res = await fetch(`${PAC_BASE}/service.json?${qs}`, { headers: { "AUTH-KEY": key } });
  const body = (await res.json().catch(() => null)) as { services?: { service?: PacService | PacService[] }; error?: { errorMessage?: string } } | null;
  if (!res.ok || body?.error) {
    throw new Error(body?.error?.errorMessage ?? `Australia Post returned ${res.status}`);
  }
  const raw = body?.services?.service;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const free = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS;
  const rates = list
    .filter((s): s is PacService & { code: string } => typeof s.code === "string" && CODE_ORDER.includes(s.code))
    .map((s) => {
      const priceCents = Math.round(Number(s.price ?? 0) * 100);
      return {
        code: s.code,
        name: String(s.name ?? s.code),
        priceCents,
        // Free shipping applies to the standard service only.
        chargeCents: free && s.code === "AUS_PARCEL_REGULAR" ? 0 : priceCents,
        etaDays: ETA[s.code],
      };
    })
    .filter((r) => r.priceCents > 0);

  rates.sort((a, b) => CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code));
  return rates;
}
