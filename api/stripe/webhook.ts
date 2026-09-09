// POST /api/stripe/webhook — Stripe → Maison Obsidian.
//
// Register https://<site>/api/stripe/webhook in the Stripe dashboard with
// these events, and put the signing secret in STRIPE_WEBHOOK_SECRET:
//   checkout.session.completed   reservations recorded / subscription started
//   invoice.upcoming             re-price the coming month to the customer's pick
//   invoice.paid                 record the month's delivery; end after month 12
//   customer.subscription.deleted  mark cancelled
// Every handler is idempotent, so Stripe's retries are safe.

import { getStripe, json, rawBody, serviceClient } from "../_lib/stripe";
import { prepareRenewal, recordRenewal, recordReservation, recordSubscriptionStart } from "../_lib/record";
import type Stripe from "stripe";

export const config = { runtime: "nodejs", api: { bodyParser: false } };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const stripe = getStripe();
  const db = serviceClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !db || !secret) return json(res, 501, { error: "Stripe webhook isn't configured" });

  let event: Stripe.Event;
  try {
    const sig = String(req.headers["stripe-signature"] ?? "");
    event = stripe.webhooks.constructEvent(await rawBody(req), sig, secret);
  } catch (e) {
    return json(res, 400, { error: `Bad signature: ${e instanceof Error ? e.message : "unknown"}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "payment" && session.metadata?.kind === "reservation") await recordReservation(stripe, db, session);
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
      default:
        break;
    }
    return json(res, 200, { received: true });
  } catch (e) {
    console.error("stripe webhook:", event.type, e);
    return json(res, 500, { error: "handler failed" });
  }
}
