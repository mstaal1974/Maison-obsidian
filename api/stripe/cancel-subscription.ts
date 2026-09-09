// POST /api/stripe/cancel-subscription { id } — the owner ends their Monthly Pour.
// Cancels at Stripe immediately (no further charges); months already paid
// still ship. The webhook marks the row cancelled too, so this is belt and braces.

import { getStripe, json, readBody, serviceClient, userFromRequest, route } from "../_lib/stripe.js";

export const config = { runtime: "nodejs" };

export default route("cancel-subscription", async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const stripe = getStripe();
  const db = serviceClient();
  if (!stripe || !db) return json(res, 501, { error: "Stripe isn't configured" });
  const user = await userFromRequest(req);
  if (!user) return json(res, 401, { error: "Sign in" });
  const id = String(readBody(req).id ?? "");
  const { data: sub } = await db.from("scent_subscriptions").select("id, user_id, status, stripe_subscription_id").eq("id", id).maybeSingle();
  if (!sub || sub.user_id !== user.id) return json(res, 404, { error: "Subscription not found" });
  if (sub.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!/No such subscription|already been canceled|canceled subscription/i.test(msg)) return json(res, 502, { error: "Stripe could not cancel the subscription" });
    }
  }
  await db.from("scent_subscriptions").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", id).eq("status", "active");
  return json(res, 200, { ok: true });
});
