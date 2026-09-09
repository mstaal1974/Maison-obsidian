// GET /api/stripe/confirm?session_id=cs_… — the customer is back from Checkout.
//
// Records the outcome if the webhook hasn't yet (both paths are idempotent)
// and tells the page what was reserved or started. Only the session's owner
// may confirm it.

import { getStripe, json, serviceClient, userFromRequest } from "../_lib/stripe";
import { recordReservation, recordSubscriptionStart } from "../_lib/record";

export const config = { runtime: "nodejs" };

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const stripe = getStripe();
  const db = serviceClient();
  if (!stripe || !db) return json(res, 501, { error: "Stripe isn't configured" });
  const user = await userFromRequest(req);
  if (!user) return json(res, 401, { error: "Sign in" });
  const id = String(req.query?.session_id ?? "");
  if (!id.startsWith("cs_")) return json(res, 400, { error: "Missing session" });

  const session = await stripe.checkout.sessions.retrieve(id);
  if (session.metadata?.user_id !== user.id) return json(res, 403, { error: "Not your session" });
  if (session.status !== "complete") return json(res, 409, { error: "Payment not completed", status: session.status });

  if (session.mode === "payment") {
    await recordReservation(stripe, db, session);
    return json(res, 200, { kind: "reservation", lines: JSON.parse(session.metadata?.lines ?? "[]"), amountTotal: session.amount_total });
  }
  if (session.mode === "subscription") {
    await recordSubscriptionStart(stripe, db, session);
    return json(res, 200, { kind: "subscription" });
  }
  return json(res, 200, { kind: "other" });
}
