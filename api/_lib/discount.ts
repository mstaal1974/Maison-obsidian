// Gift voucher and promo codes entered on our own /checkout page, so customers
// never have to find Stripe's "Add promotion code". Served by the checkout
// function (the Hobby plan allows 12):
//
//   POST /api/stripe/checkout { kind: "check-code", code, subtotalCents }
//     → { code, label, amountOffCents | percentOff } or 400 with the reason
//
// The same lookup runs again when the payment session is created, and the
// code is applied there as a Stripe discount: nothing the browser says about
// a code's value is trusted.

import type Stripe from "stripe";
import { CURRENCY, json } from "./stripe.js";

export interface FoundCode {
  promo: Stripe.PromotionCode;
  label: string;
  amountOffCents: number | null;
  percentOff: number | null;
}

/** A usable promotion code, or the reason it can't be used. */
export async function findCode(stripe: Stripe, raw: unknown, subtotalCents?: number): Promise<FoundCode | { error: string }> {
  const code = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!code || code.length > 40 || !/^[A-Z0-9_-]+$/.test(code)) return { error: "Enter a gift voucher or promo code." };
  const list = await stripe.promotionCodes.list({ code, limit: 1, expand: ["data.promotion.coupon"] });
  const promo = list.data[0];
  const coupon = promo?.promotion?.coupon && typeof promo.promotion.coupon === "object" ? promo.promotion.coupon : null;
  if (!promo || !coupon) return { error: "We couldn't find that code — check it and try again." };
  const now = Math.floor(Date.now() / 1000);
  if (promo.max_redemptions != null && promo.times_redeemed >= promo.max_redemptions) return { error: "That code has already been used." };
  if (promo.expires_at != null && promo.expires_at <= now) return { error: "That code has expired." };
  if (!promo.active || !coupon.valid) return { error: "That code is no longer active." };
  if (coupon.amount_off != null && coupon.currency && coupon.currency.toLowerCase() !== CURRENCY.toLowerCase()) return { error: "That code can't be used in this store." };
  const min = promo.restrictions?.minimum_amount;
  if (min != null && subtotalCents != null && subtotalCents < min) {
    return { error: `That code needs an order of at least $${(min / 100).toFixed(min % 100 ? 2 : 0)}.` };
  }
  return {
    promo,
    label: promo.metadata?.kind === "voucher" || coupon.metadata?.kind === "voucher" ? "Gift voucher" : "Promo code",
    amountOffCents: coupon.amount_off ?? null,
    percentOff: coupon.percent_off ?? null,
  };
}

// Guessing codes one by one: a few dozen tries a minute per visitor is plenty.
const tries = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (tries.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  tries.set(ip, recent);
  return recent.length > 20;
}

/** The code box's "Apply": what the code is worth, so the summary can show it. */
export async function checkCode(req: any, res: any, stripe: Stripe, body: Record<string, any>) {
  const fwd = req.headers?.["x-forwarded-for"];
  const ip = String(Array.isArray(fwd) ? fwd[0] : (fwd ?? "")).split(",")[0].trim() || "unknown";
  if (tooMany(ip)) return json(res, 429, { error: "Too many tries — wait a minute and try again." });
  const subtotal = Number.isFinite(Number(body.subtotalCents)) ? Number(body.subtotalCents) : undefined;
  const found = await findCode(stripe, body.code, subtotal);
  if ("error" in found) return json(res, 400, { error: found.error });
  return json(res, 200, { code: found.promo.code, label: found.label, amountOffCents: found.amountOffCents, percentOff: found.percentOff });
}
