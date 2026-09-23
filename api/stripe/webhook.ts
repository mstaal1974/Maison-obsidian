// POST /api/stripe/webhook — Stripe → Maison Obsidian.
//
// Register https://<site>/api/stripe/webhook in the Stripe dashboard with
// these events, and put the signing secret in STRIPE_WEBHOOK_SECRET:
//   checkout.session.completed   orders recorded / subscription started
//   checkout.session.async_payment_succeeded  the same, for delayed payment methods
//   invoice.upcoming             re-price the coming month to the customer's pick
//   invoice.paid                 record the month's delivery; end after month 12
//   customer.subscription.deleted  mark cancelled
//   charge.refunded              void an order once it is fully refunded
//   charge.dispute.created       flag the order as disputed
// Every handler is idempotent, so Stripe's retries are safe.

import { getStripe, json, rawBody, serviceClient, route, notConfigured } from "../_lib/stripe.js";
import { prepareRenewal, recordDispute, recordRefund, recordRenewal, recordOrder, recordSubscriptionStart } from "../_lib/record.js";
import type Stripe from "stripe";

export const config = { runtime: "nodejs", api: { bodyParser: false } };

export default route("webhook", async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const stripe = getStripe();
  const db = serviceClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !db || !secret) return notConfigured(res, "Stripe webhook", ["stripe", "service", "webhook"]);

  const body = await rawBody(req);
  if (!body) {
    // The platform parsed the JSON before we could read the bytes Stripe
    // signed. Every event will fail until that is fixed, so say it plainly.
    console.error("stripe webhook: raw body unavailable — the request body was parsed before signature verification");
    return json(res, 400, { error: "Raw body unavailable for signature verification" });
  }
  let event: Stripe.Event;
  try {
    const sig = String(req.headers["stripe-signature"] ?? "");
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    console.error("stripe webhook: signature verification failed", e instanceof Error ? e.message : e);
    return json(res, 400, { error: "Bad signature" });
  }

  try {
    switch (event.type) {
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.payment_status !== "paid") break;
        if (session.mode === "payment" && session.metadata?.kind === "order") await recordOrder(stripe, db, session);
        if (session.mode === "subscription") await recordSubscriptionStart(stripe, db, session);
        break;
      }
      case "invoice.upcoming": {
        const inv = event.data.object as unknown as { subscription?: string | { id: string } | null; parent?: { subscription_details?: { subscription?: string | { id: string } | null } } };
        const raw = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
        const id = typeof raw === "string" ? raw : raw?.id;
        if (id) await prepareRenewal(stripe, db, id);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object;
        if (invoice.billing_reason === "subscription_cycle") await recordRenewal(stripe, db, invoice);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await db.from("scent_subscriptions").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("stripe_subscription_id", sub.id).eq("status", "active");
        break;
      }
      case "charge.refunded":
        await recordRefund(db, event.data.object);
        break;
      case "charge.dispute.created":
        await recordDispute(db, event.data.object);
        break;
      default:
        break;
    }
    return json(res, 200, { received: true });
  } catch (e) {
    console.error("stripe webhook:", event.type, e);
    return json(res, 500, { error: "handler failed" });
  }
});
