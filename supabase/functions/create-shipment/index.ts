// Supabase Edge Function — buy a shipping label for a commit and record it.
//
// Provider-agnostic seam. Set SHIPPING_PROVIDER to "shippo" | "easypost" |
// "shopify" and the matching API key; fill in the provider call below. Deploy:
//   supabase functions deploy create-shipment
//   supabase secrets set SHIPPING_PROVIDER=shippo SHIPPO_API_KEY=... \
//                        SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
//
// It runs with the service-role key so it can write shipments regardless of RLS.
// Given a commit id + destination address it: (1) asks the provider for a label,
// (2) inserts/updates the shipment row with carrier + tracking. Until a provider
// is wired it returns a stubbed tracking number so the flow is exercised.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Address {
  name: string;
  line1: string;
  city: string;
  region: string;
  postal: string;
  country: string;
}
interface Payload {
  commitId: string;
  shipTo: Address;
}

const provider = Deno.env.get("SHIPPING_PROVIDER") ?? "manual";
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface Label {
  carrier: string;
  service: string;
  trackingNumber: string;
  trackingUrl: string;
}

async function buyLabel(_shipTo: Address): Promise<Label> {
  // TODO: implement per provider, e.g.
  //   shippo:   POST https://api.goshippo.com/shipments + /transactions
  //   easypost: POST https://api.easypost.com/v2/shipments then .buy()
  //   shopify:  Admin API fulfillment + tracking on the order
  // Return the carrier + tracking from the provider response.
  const stub = `1Z${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
  return {
    carrier: "USPS",
    service: "Priority",
    trackingNumber: stub,
    trackingUrl: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${stub}`,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: "create-shipment is not configured" }, { status: 501 });
  }

  const { commitId, shipTo } = (await req.json()) as Payload;
  const db = createClient(supabaseUrl, serviceKey);

  const { data: commit, error: cErr } = await db
    .from("commits")
    .select("id, user_id, fragrance_id")
    .eq("id", commitId)
    .single();
  if (cErr || !commit) return Response.json({ error: "unknown commit" }, { status: 404 });

  let label: Label;
  try {
    label = await buyLabel(shipTo);
  } catch (e) {
    return Response.json({ error: `label failed: ${String(e)}` }, { status: 502 });
  }

  const { data, error } = await db
    .from("shipments")
    .insert({
      commit_id: commit.id,
      user_id: commit.user_id,
      fragrance_id: commit.fragrance_id,
      provider,
      carrier: label.carrier,
      service: label.service,
      tracking_number: label.trackingNumber,
      tracking_url: label.trackingUrl,
      ship_to: shipTo,
      status: "label_created",
    })
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, shipmentId: data.id, provider, ...label });
});
