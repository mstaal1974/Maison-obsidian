// POST /api/stripe/portal — a Stripe Billing Portal link for the signed-in
// customer to update their card or see invoices.

import { customerFor, getStripe, json, serviceClient, siteUrl, userFromRequest , route } from "../_lib/stripe";

export const config = { runtime: "nodejs" };

export default route("portal", async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const stripe = getStripe();
  const db = serviceClient();
  if (!stripe || !db) return json(res, 501, { error: "Stripe isn't configured" });
  const user = await userFromRequest(req);
  if (!user) return json(res, 401, { error: "Sign in" });
  const customer = await customerFor(stripe, db, user);
  const portal = await stripe.billingPortal.sessions.create({ customer, return_url: `${siteUrl(req)}/#/account` });
  return json(res, 200, { url: portal.url });
});
