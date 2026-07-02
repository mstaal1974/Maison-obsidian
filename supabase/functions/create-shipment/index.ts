// Supabase Edge Function — fulfill a commit via Australia Post Parcel Post.
//
// Wired to two Australia Post APIs:
//   • PAC (Postage Assessment Calculation) — domestic Parcel Post rate
//       GET https://digitalapi.auspost.com.au/postage/parcel/domestic/calculate.json
//       header: AUTH-KEY: <AUSPOST_PAC_KEY>   service_code: AUS_PARCEL_REGULAR
//   • Shipping & Tracking API — create a shipment + buy a label
//       POST https://digitalapi.auspost.com.au/shipping/v1/shipments
//       Basic auth base64("<AUSPOST_API_KEY>:<AUSPOST_API_PASSWORD>")
//       header: Account-Number: <AUSPOST_ACCOUNT_NUMBER>
//
// Deploy:  supabase functions deploy create-shipment
// Secrets: supabase secrets set \
//   AUSPOST_PAC_KEY=... AUSPOST_API_KEY=... AUSPOST_API_PASSWORD=... \
//   AUSPOST_ACCOUNT_NUMBER=... AUSPOST_FROM_POSTCODE=6000 \
//   AUSPOST_FROM_NAME="Maison Obsidian" AUSPOST_FROM_LINE1="1 Atelier Ln" \
//   AUSPOST_FROM_SUBURB=Perth AUSPOST_FROM_STATE=WA \
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
//
// Runs with the service-role key so it can write shipments past RLS. Given a
// commit id + destination it rates Parcel Post, buys a label, and records the
// shipment with the AusPost article id as the tracking number. If the AusPost
// creds aren't set it falls back to a stubbed article id so the flow still runs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAC_BASE = "https://digitalapi.auspost.com.au/postage/parcel/domestic";
const SHIP_BASE = "https://digitalapi.auspost.com.au/shipping/v1";
const PARCEL_POST = "AUS_PARCEL_REGULAR"; // PAC service code for Parcel Post

interface Address {
  name: string;
  line1: string;
  suburb: string;
  state: string;
  postcode: string;
}
interface Payload {
  commitId: string;
  shipTo: Address;
  weightKg?: number;
  length?: number; // cm
  width?: number;
  height?: number;
}

const env = (k: string) => Deno.env.get(k);
const supabaseUrl = env("SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

function trackingUrl(article: string): string {
  return `https://auspost.com.au/mypost/track/details/${article}`;
}

// Domestic Parcel Post rate (AUD). Returns null if PAC isn't configured.
async function parcelPostRate(to: Address, dims: Required<Pick<Payload, "weightKg" | "length" | "width" | "height">>): Promise<number | null> {
  const key = env("AUSPOST_PAC_KEY");
  const from = env("AUSPOST_FROM_POSTCODE");
  if (!key || !from) return null;
  const qs = new URLSearchParams({
    from_postcode: from,
    to_postcode: to.postcode,
    length: String(dims.length),
    width: String(dims.width),
    height: String(dims.height),
    weight: String(dims.weightKg),
    service_code: PARCEL_POST,
  });
  const res = await fetch(`${PAC_BASE}/calculate.json?${qs}`, { headers: { "AUTH-KEY": key } });
  if (!res.ok) throw new Error(`PAC ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const price = Number(data?.postage_result?.total_cost);
  return Number.isFinite(price) ? price : null;
}

// Create a shipment + label via the Shipping API. Returns the article id.
async function createParcelPostLabel(to: Address, dims: Required<Pick<Payload, "weightKg">>): Promise<{ article: string; costAud: number | null }> {
  const apiKey = env("AUSPOST_API_KEY");
  const apiPass = env("AUSPOST_API_PASSWORD");
  const account = env("AUSPOST_ACCOUNT_NUMBER");
  // Fall back to a stub article id until the merchant account is wired.
  if (!apiKey || !apiPass || !account) {
    return { article: `MO${Math.random().toString().slice(2, 12)}`, costAud: null };
  }
  const auth = btoa(`${apiKey}:${apiPass}`);
  const body = {
    shipments: [
      {
        from: {
          name: env("AUSPOST_FROM_NAME") ?? "Maison Obsidian",
          lines: [env("AUSPOST_FROM_LINE1") ?? ""],
          suburb: env("AUSPOST_FROM_SUBURB") ?? "",
          state: env("AUSPOST_FROM_STATE") ?? "",
          postcode: env("AUSPOST_FROM_POSTCODE") ?? "",
        },
        to: {
          name: to.name,
          lines: [to.line1],
          suburb: to.suburb,
          state: to.state,
          postcode: to.postcode,
        },
        items: [
          {
            // Parcel Post product; set your account's product_id in the portal.
            product_id: env("AUSPOST_PRODUCT_ID") ?? "T28",
            item_reference: "maison-obsidian",
            weight: dims.weightKg,
            authority_to_leave: false,
          },
        ],
      },
    ],
  };
  const res = await fetch(`${SHIP_BASE}/shipments`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Account-Number": account,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AusPost shipments ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const item = data?.shipments?.[0]?.items?.[0];
  const article = item?.tracking_details?.article_id ?? item?.article_id;
  if (!article) throw new Error("no article id returned");
  return { article, costAud: null };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: "create-shipment is not configured" }, { status: 501 });
  }

  const { commitId, shipTo, weightKg = 0.25, length = 15, width = 10, height = 8 } = (await req.json()) as Payload;
  const db = createClient(supabaseUrl, serviceKey);

  const { data: commit, error: cErr } = await db
    .from("commits")
    .select("id, user_id, fragrance_id")
    .eq("id", commitId)
    .single();
  if (cErr || !commit) return Response.json({ error: "unknown commit" }, { status: 404 });

  let article: string;
  let rateAud: number | null = null;
  try {
    rateAud = await parcelPostRate(shipTo, { weightKg, length, width, height }).catch(() => null);
    const label = await createParcelPostLabel(shipTo, { weightKg });
    article = label.article;
  } catch (e) {
    return Response.json({ error: `AusPost: ${String(e)}` }, { status: 502 });
  }

  const { data, error } = await db
    .from("shipments")
    .insert({
      commit_id: commit.id,
      user_id: commit.user_id,
      fragrance_id: commit.fragrance_id,
      provider: "auspost",
      carrier: "Australia Post",
      service: "Parcel Post",
      tracking_number: article,
      tracking_url: trackingUrl(article),
      ship_to: shipTo,
      status: "label_created",
    })
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    ok: true,
    shipmentId: data.id,
    carrier: "Australia Post",
    service: "Parcel Post",
    trackingNumber: article,
    trackingUrl: trackingUrl(article),
    rateAud,
  });
});
