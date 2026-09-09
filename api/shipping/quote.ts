// POST /api/shipping/quote { lines, postcode } — live Australia Post rates.
//
// The bag prices itself here (never from the browser) so the free-shipping
// threshold is applied to a subtotal we trust, then the parcel is measured and
// quoted. Returns the services the customer can choose at checkout.

import { type CheckoutLine, json, loadCatalogue, priceLines, readBody, route } from "../_lib/stripe.js";
import { FREE_SHIPPING_THRESHOLD_CENTS, auspostConfigured, quoteRates } from "../_lib/auspost.js";
import { MAX_PARCEL_KG, parcelFor } from "../_lib/parcel.js";

export const config = { runtime: "nodejs" };

const POSTCODE = /^\d{4}$/;

export default route("shipping/quote", async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!auspostConfigured()) {
    return json(res, 501, {
      error: "Postage lookup isn't configured",
      detail: "Missing in Vercel: " + [!process.env.AUSPOST_PAC_KEY && "AUSPOST_PAC_KEY", !process.env.AUSPOST_FROM_POSTCODE && "AUSPOST_FROM_POSTCODE"].filter(Boolean).join(", "),
    });
  }

  const body = readBody(req);
  const postcode = String(body.postcode ?? "").trim();
  if (!POSTCODE.test(postcode)) return json(res, 400, { error: "Enter a four-digit Australian postcode" });

  const lines = (Array.isArray(body.lines) ? body.lines : []) as CheckoutLine[];
  if (!lines.length) return json(res, 400, { error: "Your bag is empty" });

  let priced;
  try {
    priced = priceLines(lines, await loadCatalogue());
  } catch (e) {
    return json(res, 400, { error: e instanceof Error ? e.message : "Invalid bag" });
  }
  const subtotalCents = priced.reduce((n, l) => n + l.unitCents * l.qty, 0);
  const parcel = parcelFor(priced.map((l) => ({ format: l.format, qty: l.qty })));
  if (parcel.weightKg > MAX_PARCEL_KG) {
    return json(res, 400, { error: `That order weighs ${parcel.weightKg} kg — over Australia Post's ${MAX_PARCEL_KG} kg parcel limit. Please split it into two orders.` });
  }

  const rates = await quoteRates(parcel, postcode, subtotalCents);
  if (!rates.length) return json(res, 502, { error: "Australia Post returned no services for that postcode" });

  return json(res, 200, { rates, parcel, subtotalCents, freeThresholdCents: FREE_SHIPPING_THRESHOLD_CENTS });
});
