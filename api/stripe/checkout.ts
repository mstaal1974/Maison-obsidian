// POST /api/stripe/checkout — a hosted Stripe Checkout Session for the bag.
// The browser redirects to session.url and Stripe brings the customer back to
// success_url (or cancel_url).
//
// Prices are computed from the live catalogue, never from the browser. The
// PaymentIntent is created with capture_method "manual" (a hold, captured
// when the batch pours) and the card is saved off-session so a batch that
// outlives the hold can still be charged. Commits are recorded by the webhook
// (and by /api/stripe/confirm on return, whichever comes first).

import { type CheckoutLine, customerFor, getStripe, json, loadCatalogue, priceLines, readBody, serviceClient, siteUrl, userFromRequest, CURRENCY, route, notConfigured } from "../_lib/stripe.js";

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
    success_url: `${site}/#/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/#/?checkout=cancelled`,
  });
  return json(res, 200, { url: session.url, sessionId: session.id });
});
