// POST /api/stripe/capture { fragranceId, action: "capture" | "release" } — admin.
//
// capture: the batch is met — capture every authorised hold. A hold Stripe
//          has already expired (cards allow about seven days) is charged
//          off-session with the saved card instead, so late batches still pour.
// release: the batch closed short — cancel the holds; the commits trigger
//          hands the spots back.
// The same logic as the capture-batch Edge Function, reachable from the console.

import { getStripe, isAdminRequest, json, readBody, serviceClient, CURRENCY , route } from "../_lib/stripe";

export const config = { runtime: "nodejs" };

interface CommitRow {
  id: string;
  payment_intent_id: string | null;
  payment_method_id: string | null;
  stripe_customer_id: string | null;
  charge_cents: number | null;
  qty: number | null;
}

export default route("capture", async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const stripe = getStripe();
  const db = serviceClient();
  if (!stripe || !db) return json(res, 501, { error: "Stripe isn't configured" });
  if (!(await isAdminRequest(req))) return json(res, 403, { error: "Admins only" });

  const { fragranceId, action } = readBody(req) as { fragranceId?: string; action?: string };
  if (!fragranceId || (action !== "capture" && action !== "release")) return json(res, 400, { error: "fragranceId and action required" });

  const { data: frag } = await db.from("fragrances").select("id, moq, committed").eq("id", fragranceId).single();
  if (!frag) return json(res, 404, { error: "Unknown fragrance" });
  if (action === "capture" && frag.committed < frag.moq) return json(res, 409, { error: "Batch not met", committed: frag.committed, moq: frag.moq });

  const { data: commits } = await db.from("commits").select("id, payment_intent_id, payment_method_id, stripe_customer_id, charge_cents, qty").eq("fragrance_id", fragranceId).eq("status", "authorized");
  const results: { id: string; outcome: string }[] = [];
  const byIntent = new Map<string, CommitRow[]>();
  for (const c of (commits ?? []) as CommitRow[]) {
    if (!c.payment_intent_id || c.payment_intent_id.startsWith("pi_stub_")) {
      results.push({ id: c.id, outcome: "no-intent" });
      continue;
    }
    byIntent.set(c.payment_intent_id, [...(byIntent.get(c.payment_intent_id) ?? []), c]);
  }

  for (const [piId, group] of byIntent) {
    const ids = group.map((c) => c.id);
    try {
      if (action === "release") {
        const pi = await stripe.paymentIntents.retrieve(piId);
        if (pi.status === "requires_capture") await stripe.paymentIntents.cancel(piId);
        await db.from("commits").update({ status: "released" }).in("id", ids);
        ids.forEach((id) => results.push({ id, outcome: "released" }));
        continue;
      }
      const pi = await stripe.paymentIntents.retrieve(piId);
      if (pi.status === "requires_capture") {
        await stripe.paymentIntents.capture(piId);
      } else if (pi.status === "succeeded") {
        /* already captured */
      } else {
        // Hold expired: charge the saved card off-session for this session's lines.
        const first = group[0];
        if (!first.payment_method_id || !first.stripe_customer_id) throw new Error("hold expired and no saved card");
        const amount = group.reduce((s, c) => s + (c.charge_cents ?? 0) * (c.qty ?? 1), 0);
        const fresh = await stripe.paymentIntents.create({
          amount,
          currency: CURRENCY,
          customer: first.stripe_customer_id,
          payment_method: first.payment_method_id,
          off_session: true,
          confirm: true,
          metadata: { kind: "reservation-recharge", fragrance_id: fragranceId },
        });
        await db.from("commits").update({ payment_intent_id: fresh.id }).in("id", ids);
      }
      await db.from("commits").update({ status: "captured" }).in("id", ids);
      ids.forEach((id) => results.push({ id, outcome: "captured" }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "failed";
      ids.forEach((id) => results.push({ id, outcome: `failed: ${msg}` }));
    }
  }
  return json(res, 200, { ok: true, action, results });
});
