// GET /api/stripe/confirm?session_id=cs_… — the customer is back from Checkout.
//
// Records the outcome if the webhook hasn't yet (both paths are idempotent)
// and tells the page what was ordered or started. A session placed by a
// signed-in customer may only be confirmed by them; a guest's session is
// confirmed by whoever holds the session id, which Stripe only ever gives to
// the buyer's own browser.

import { getStripe, json, serviceClient, userFromRequest, route, notConfigured } from "../_lib/stripe.js";
import { bagLines, recordOrder, recordSubscriptionStart } from "../_lib/record.js";

export const config = { runtime: "nodejs" };

export default route("confirm", async function handler(req: any, res: any) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const stripe = getStripe();
  const db = serviceClient();
  if (!stripe || !db) return notConfigured(res, "Stripe", ["stripe", "service"]);
  const user = await userFromRequest(req);
  const id = String(req.query?.session_id ?? "");
  if (!id.startsWith("cs_")) return json(res, 400, { error: "Missing session" });

  const session = await stripe.checkout.sessions.retrieve(id);
  const owner = session.metadata?.user_id ?? "";
  if (owner && owner !== user?.id) return json(res, 403, { error: "Not your session" });
  if (session.status !== "complete" || session.payment_status !== "paid") return json(res, 409, { error: "Payment not completed", status: session.status });

  if (session.mode === "payment") {
    await recordOrder(stripe, db, session);
    return json(res, 200, { kind: "order", lines: await bagLines(stripe, session), amountTotal: session.amount_total });
  }
  if (session.mode === "subscription") {
    await recordSubscriptionStart(stripe, db, session);
    return json(res, 200, { kind: "subscription" });
  }
  return json(res, 200, { kind: "other" });
});
