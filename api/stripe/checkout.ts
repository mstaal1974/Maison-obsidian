// POST /api/stripe/checkout — a hosted Stripe Checkout Session for the bag.
// The browser redirects to session.url and Stripe brings the customer back to
// success_url (or cancel_url).
//
// Prices are computed from the live catalogue, never from the browser. The
// card is charged when the customer pays — a normal store checkout. Orders
// are recorded by the webhook (and by /api/stripe/confirm on return,
// whichever comes first).

import { type CheckoutLine, customerFor, getStripe, json, loadCatalogue, priceLines, readBody, serviceClient, siteUrl, userFromRequest, CURRENCY, route, notConfigured } from "../_lib/stripe.js";
import { auspostConfigured, quoteRates } from "../_lib/auspost.js";
import { parcelFor } from "../_lib/parcel.js";

export const config = { runtime: "nodejs" };

export default route("checkout", async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const stripe = getStripe();
  const db = serviceClient();
  if (!stripe || !db) return notConfigured(res, "Stripe checkout", ["stripe", "service"]);
  const user = await userFromRequest(req);
  if (!user) return json(res, 401, { error: "Sign in to reserve" });

  const body = readBody(req);
  const lines = (Array.isArray(body.lines) ? body.lines : []) as CheckoutLine[];
  if (!lines.length) return json(res, 400, { error: "Your bag is empty" });

  let priced;
  try {
    priced = priceLines(lines, await loadCatalogue());
  } catch (e) {
    return json(res, 400, { error: e instanceof Error ? e.message : "Invalid bag" });
  }

  // Postage is re-quoted here rather than trusted from the browser, so the
  // rate charged is the one Australia Post actually returns for this parcel.
  const postcode = String(body.postcode ?? "").trim();
  const serviceCode = String(body.shippingCode ?? "").trim();
  let shipping: { name: string; chargeCents: number; etaDays?: { min: number; max: number } } | null = null;
  if (auspostConfigured() && /^\d{4}$/.test(postcode) && serviceCode) {
    const subtotalCents = priced.reduce((n, l) => n + l.unitCents * l.qty, 0);
    const rates = await quoteRates(parcelFor(priced.map((l) => ({ format: l.format, qty: l.qty }))), postcode, subtotalCents);
    const chosen = rates.find((r) => r.code === serviceCode);
    if (!chosen) return json(res, 400, { error: "That postage option is no longer available — please recalculate." });
    shipping = { name: chosen.name, chargeCents: chosen.chargeCents, etaDays: chosen.etaDays };
  }

  const customer = await customerFor(stripe, db, user);
  const site = siteUrl(req);
  const compact = priced.map((l) => ({ f: l.fragranceId, k: l.format, q: l.qty, e: l.engraving, s: l.sizeMl, u: l.unitCents }));

  const session = await stripe.checkout.sessions.create({
    // Checkout Studio configuration (hosted page).
    ui_mode: "hosted_page",
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    allow_promotion_codes: false,
    submit_type: "auto",
    integration_identifier: "hosted_web_0001",
    origin_context: "web",
    mode: "payment",
    shipping_address_collection: { allowed_countries: ["AU"] },
    ...(shipping
      ? {
          shipping_options: [
            {
              shipping_rate_data: {
                type: "fixed_amount" as const,
                fixed_amount: { amount: shipping.chargeCents, currency: CURRENCY },
                display_name: shipping.chargeCents === 0 ? `${shipping.name} — free` : shipping.name,
                ...(shipping.etaDays ? { delivery_estimate: { minimum: { unit: "business_day" as const, value: shipping.etaDays.min }, maximum: { unit: "business_day" as const, value: shipping.etaDays.max } } } : {}),
              },
            },
          ],
        }
      : {}),
    customer,
    line_items: priced.map((l) => ({
      quantity: l.qty,
      price_data: {
        currency: CURRENCY,
        unit_amount: l.unitCents,
        product_data: {
          name: `${l.name} — ${l.formatName}`,
          description: l.engraving ? `Engraved “${l.engraving}”` : undefined,
        },
      },
    })),
    payment_intent_data: { metadata: { user_id: user.id, kind: "order" } },
    metadata: { user_id: user.id, user_email: user.email ?? "", kind: "order", lines: JSON.stringify(compact).slice(0, 490) },
    success_url: `${site}/#/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/#/?checkout=cancelled`,
  });
  return json(res, 200, { url: session.url, sessionId: session.id });
});
