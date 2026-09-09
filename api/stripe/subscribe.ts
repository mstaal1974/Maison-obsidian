// POST /api/stripe/subscribe — a Checkout Session for the Monthly Pour,
// rendered as Stripe's embedded payment form (ui_mode "form") on the
// Subscribe page. Returns { client_secret } for the Checkout Form SDK.
//
// A real Stripe subscription, monthly, priced at 10% under the first pick's
// shelf price (surprise mode: the house draws month 1 here). Before each
// renewal the webhook re-prices the subscription to the upcoming pick, and
// after the twelfth paid month it cancels it.

import { customerFor, getStripe, json, loadCatalogue, memberPrice, readBody, serviceClient, siteUrl, userFromRequest, CURRENCY, route, notConfigured } from "../_lib/stripe.js";
import { type FormatKey, FORMAT_BY_KEY, SUBSCRIPTION_MONTHS } from "../_lib/catalogue.js";

export const config = { runtime: "nodejs" };

const FORMATS: FormatKey[] = ["perf10", "perf30", "perf50", "car"];

export default route("subscribe", async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const stripe = getStripe();
  const db = serviceClient();
  if (!stripe || !db) return notConfigured(res, "Stripe checkout", ["stripe", "service"]);
  const user = await userFromRequest(req);
  if (!user) return json(res, 401, { error: "Sign in to subscribe" });

  const body = readBody(req);
  const format = body.format as FormatKey;
  const pickMode = body.pickMode === "surprise" ? "surprise" : "choose";
  if (!FORMATS.includes(format)) return json(res, 400, { error: "Choose a format" });

  const { data: existing } = await db.from("scent_subscriptions").select("id").eq("user_id", user.id).eq("status", "active").limit(1);
  if (existing?.length) return json(res, 409, { error: "You already have an active subscription" });

  const catalogue = await loadCatalogue();
  let fragranceId: string | null = typeof body.fragranceId === "string" ? body.fragranceId : null;
  if (pickMode === "surprise" || !fragranceId) {
    const pool = [...catalogue.values()].filter((f) => !f.vipOnly && (f.formatStatus?.[format] ?? "live") !== "hidden");
    if (!pool.length) return json(res, 400, { error: "Nothing to pour" });
    fragranceId = pool[Math.floor(Math.random() * pool.length)].id;
  }
  const frag = catalogue.get(fragranceId);
  if (!frag) return json(res, 400, { error: "Choose a scent" });
  const unit = memberPrice(frag, format);

  const customer = await customerFor(stripe, db, user);
  const site = siteUrl(req);
  const meta = { user_id: user.id, user_email: user.email ?? "", kind: "subscription", format, pick_mode: pickMode, fragrance_id: fragranceId, months: String(SUBSCRIPTION_MONTHS) };

  const session = await stripe.checkout.sessions.create({
    // Checkout Studio configuration (embedded form).
    ui_mode: "form",
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    submit_type: "auto",
    integration_identifier: "custom_embedded_web_0002",
    payment_method_collection: "always",
    mode: "subscription",
    customer,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: unit,
          recurring: { interval: "month" },
          product_data: { name: `The Monthly Pour — ${FORMAT_BY_KEY[format].name}`, description: `One fragrance a month for ${SUBSCRIPTION_MONTHS} months, 10% under shelf price` },
        },
      },
    ],
    subscription_data: { metadata: meta },
    metadata: meta,
    return_url: `${site}/#/account?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
  });
  return json(res, 200, { client_secret: session.client_secret, sessionId: session.id });
});
