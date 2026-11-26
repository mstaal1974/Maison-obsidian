import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { GIFT_CODE_PATTERN, giftClaimPath, giftDescription, giftPlan } from "./subscription-gift-plan.js";
import { CURRENCY, customerFor, json, siteUrl } from "./stripe.js";

export const GIFT_REDEMPTION = "subscription-gift-redemption";

export async function startGiftRedemption(req: any, res: any, stripe: Stripe, db: SupabaseClient, code: unknown, user: { id: string; email: string | null }) {
  const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!GIFT_CODE_PATTERN.test(normalized)) return json(res, 400, { error: "Enter the Monthly Pour gift code from your card." });
  const { data: gift, error } = await db.from("gift_vouchers")
    .select("id, gift_format, gift_months, gift_revoked_at, gift_redeemed_at, gift_payment_intent_id, expires_at, recipient_email")
    .eq("code", normalized).maybeSingle();
  if (error) throw new Error(error.message);
  const plan = gift && giftPlan(gift.gift_format, gift.gift_months);
  if (!gift || !plan || gift.gift_revoked_at || gift.gift_redeemed_at || Date.parse(gift.expires_at) <= Date.now()) {
    return json(res, 400, { error: "This gift code is unavailable, expired or already redeemed." });
  }
  if (!user.email || (gift.recipient_email && gift.recipient_email.toLowerCase() !== user.email.toLowerCase())) {
    return json(res, 403, { error: "Sign in with the email address the gift was sent to." });
  }
  const active = await db.from("scent_subscriptions").select("id").eq("user_id", user.id).eq("status", "active").limit(1);
  if (active.error) throw new Error(active.error.message);
  if (active.data?.length) return json(res, 409, { error: "You can redeem this gift when your current Monthly Pour ends." });
  if (!gift.gift_payment_intent_id) throw new Error("Subscription gift is missing its payment reference");
  const payment = await stripe.paymentIntents.retrieve(gift.gift_payment_intent_id, { expand: ["latest_charge"] });
  const charge = payment.latest_charge;
  if (payment.status !== "succeeded" || typeof charge !== "object" || !charge || charge.refunded || charge.disputed) {
    return json(res, 409, { error: "This gift is no longer available. Contact us for help." });
  }

  const customer = await customerFor(stripe, db, user);
  const site = siteUrl(req);
  const meta = { kind: GIFT_REDEMPTION, gift_id: gift.id, user_id: user.id, user_email: user.email };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ui_mode: "hosted_page",
    customer,
    shipping_address_collection: { allowed_countries: ["AU"] },
    payment_method_collection: "if_required",
    allow_promotion_codes: false,
    line_items: [{ quantity: 1, price_data: {
      currency: CURRENCY, unit_amount: 0, recurring: { interval: "month" },
      product_data: { name: "Prepaid Monthly Pour", description: giftDescription(plan) },
    } }],
    metadata: meta,
    subscription_data: { metadata: meta },
    success_url: `${site}/thanks?gift=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}${giftClaimPath()}`,
  });
  return json(res, 200, { url: session.url, sessionId: session.id });
}

export function isGiftRedemption(session: Stripe.Checkout.Session): boolean {
  return session.mode === "subscription" && session.metadata?.kind === GIFT_REDEMPTION;
}

export function completedGiftRedemption(session: Stripe.Checkout.Session): boolean {
  return isGiftRedemption(session) && session.status === "complete" && session.amount_total === 0 &&
    (session.payment_status === "no_payment_required" || session.payment_status === "paid");
}

/** Finalize only after Stripe has collected the recipient's delivery address. */
export async function recordGiftRedemption(stripe: Stripe, db: SupabaseClient, session: Stripe.Checkout.Session): Promise<string> {
  if (!completedGiftRedemption(session)) throw new Error("Incomplete subscription gift redemption");
  const subscription = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const invoice = typeof session.invoice === "string" ? session.invoice : session.invoice?.id;
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const shipping = session.collected_information?.shipping_details;
  const meta = session.metadata;
  if (!subscription || !invoice || !customer || !meta?.gift_id || !meta.user_id || !meta.user_email) {
    throw new Error("Incomplete subscription gift setup");
  }
  const { data, error } = await db.rpc("redeem_subscription_gift", {
    p_gift: meta.gift_id, p_user: meta.user_id, p_email: meta.user_email,
    p_subscription: subscription, p_customer: customer, p_invoice: invoice,
    p_address: shipping ? { ...shipping.address, name: shipping.name } : null,
  });
  if (error) throw new Error(error.message);
  if (data !== "recorded" && data !== "already_recorded") await cancelGiftSubscription(stripe, subscription);
  return data;
}

export async function cancelGiftSubscription(stripe: Stripe, id: string) {
  try {
    const subscription = await stripe.subscriptions.retrieve(id);
    if (subscription.status !== "canceled" && subscription.status !== "incomplete_expired") {
      await stripe.subscriptions.cancel(id);
    }
  } catch (error) {
    if (!/No such subscription|already been canceled|canceled subscription/i.test(error instanceof Error ? error.message : "")) throw error;
  }
}

/** A full refund or dispute revokes the card and stops any future deliveries. */
export async function revokeSubscriptionGift(stripe: Stripe, db: SupabaseClient, payment: unknown) {
  const id = typeof payment === "string" ? payment : (payment as { id?: string } | null)?.id;
  if (!id) return;
  const { data, error } = await db.from("gift_vouchers").update({ gift_revoked_at: new Date().toISOString() })
    .eq("gift_payment_intent_id", id).select("gift_subscription_id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.gift_subscription_id) return;
  const sub = await db.from("scent_subscriptions").select("stripe_subscription_id").eq("id", data.gift_subscription_id).maybeSingle();
  if (sub.error) throw new Error(sub.error.message);
  if (sub.data?.stripe_subscription_id) await cancelGiftSubscription(stripe, sub.data.stripe_subscription_id);
}
