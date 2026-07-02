// Supabase Edge Function — capture (or release) a batch's held payments.
//
// Deploy:  supabase functions deploy capture-batch
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_live_... \
//                               SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
//
// Call it from an admin action or a scheduled job. Given a fragrance id it:
//   • "capture" — when committed >= moq, capture every `authorized` commit's
//     PaymentIntent and mark it `captured` (the batch pours);
//   • "release" — when the batch closed short, cancel the holds and mark the
//     commits `released` (the trigger returns the freed spots to the count).
//
// It runs with the service-role key, so it bypasses RLS to update commits — the
// browser never can. This is a stub wired to the real Stripe + Supabase SDKs;
// it isn't exercised in the offline demo (no keys), hence the graceful guards.

import Stripe from "https://esm.sh/stripe@17?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Payload {
  fragranceId: string;
  action: "capture" | "release";
}

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!stripeKey || !supabaseUrl || !serviceKey) {
    return Response.json({ error: "capture-batch is not configured" }, { status: 501 });
  }

  const { fragranceId, action } = (await req.json()) as Payload;
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const db = createClient(supabaseUrl, serviceKey);

  const { data: frag, error: fErr } = await db
    .from("fragrances")
    .select("id, moq, committed")
    .eq("id", fragranceId)
    .single();
  if (fErr || !frag) return Response.json({ error: "unknown fragrance" }, { status: 404 });

  if (action === "capture" && frag.committed < frag.moq) {
    return Response.json({ error: "batch not met", committed: frag.committed, moq: frag.moq }, { status: 409 });
  }

  const { data: commits, error: cErr } = await db
    .from("commits")
    .select("id, payment_intent_id")
    .eq("fragrance_id", fragranceId)
    .eq("status", "authorized");
  if (cErr) return Response.json({ error: cErr.message }, { status: 500 });

  let processed = 0;
  for (const c of commits ?? []) {
    if (!c.payment_intent_id || c.payment_intent_id.startsWith("pi_stub_")) continue;
    try {
      if (action === "capture") {
        await stripe.paymentIntents.capture(c.payment_intent_id);
      } else {
        await stripe.paymentIntents.cancel(c.payment_intent_id);
      }
      await db
        .from("commits")
        .update({ status: action === "capture" ? "captured" : "released" })
        .eq("id", c.id);
      processed += 1;
    } catch (e) {
      console.error(`commit ${c.id}:`, e);
    }
  }

  return Response.json({ ok: true, action, processed, total: (commits ?? []).length });
});
