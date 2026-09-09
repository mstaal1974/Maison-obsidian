// POST /api/stripe/checkout — a Checkout Session for the bag, rendered as
// Stripe's embedded payment form (ui_mode "form") inside the bag drawer.
//
// Prices are computed from the live catalogue, never from the browser. The
// PaymentIntent is created with capture_method "manual" (a hold, captured
// when the batch pours) and the card is saved off-session so a batch that
// outlives the hold can still be charged. Commits are recorded by the webhook
// (and by /api/stripe/confirm on return, whichever comes first).
// Returns { client_secret } for stripe.initCheckoutFormSdk on the client.

import { type CheckoutLine, customerFor, getStripe, json, loadCatalogue, priceLines, readBody, serviceClient, siteUrl, userFromRequest, CURRENCY } from "../_lib/stripe";

export const config = { runtime: "nodejs" };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const stripe = getStripe();
  const db = serviceClient();
  if (!stripe || !db) return json(res, 501, { error: "Stripe checkout isn't configured" });
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

  const customer = await customerFor(stripe, db, user);
  const site = siteUrl(req);
  const compact = priced.map((l) => ({ f: l.fragranceId, k: l.format, q: l.qty, e: l.engraving, s: l.sizeMl, u: l.unitCents }));

  const session = await stripe.checkout.sessions.create({
    // Checkout Studio configuration (embedded form).
    ui_mode: "form",
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    submit_type: "auto",
    integration_identifier: "custom_embedded_web_0002",
    mode: "payment",
    customer,
    line_items: priced.map((l) => ({
      quantity: l.qty,
      price_data: {
        currency: CURRENCY,
        unit_amount: l.unitCents,
        product_data: {
          name: `${l.name} — ${l.formatName}`,
          description: l.engraving ? `Engraved “${l.engraving}”` : "Reserved for the next batch pour",
        },
      },
    })),
    payment_intent_data: {
      capture_method: "manual",
      setup_future_usage: "off_session",
      metadata: { user_id: user.id, kind: "reservation" },
    },
    metadata: { user_id: user.id, user_email: user.email ?? "", kind: "reservation", lines: JSON.stringify(compact).slice(0, 490) },
    return_url: `${site}/#/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
  });
  return json(res, 200, { client_secret: session.client_secret, sessionId: session.id });
}
