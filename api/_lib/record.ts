// Writes that both the webhook and /api/stripe/confirm perform, so whichever
// runs first records the outcome and the other is a no-op.

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCatalogue, memberPrice, CURRENCY } from "./stripe.js";
import { FORMATS, type FormatKey } from "./catalogue.js";

interface CompactLine {
  f: string; // fragrance id
  k: FormatKey; // format
  q: number; // qty
  e: string | null; // engraving
  s: number; // size ml
  u: number; // unit cents
}

// ─── The bag, carried through Stripe ─────────────────────────────────────────
//
// Stripe caps a metadata value at 500 characters. The bag used to be written as
// one value truncated to 490, which silently corrupted any order past about
// eight lines: the JSON was cut mid-object, JSON.parse threw in the webhook,
// and a paid order was never recorded. It is now split across numbered keys —
// `lines`, `lines2`, `lines3` … — and joined back here.

/** Below Stripe's 500-character ceiling, with room to spare. */
export const BAG_CHUNK = 460;
/** Stripe allows 50 metadata keys; the order uses a dozen others. */
export const BAG_MAX_CHUNKS = 20;

export function chunkBag(compact: unknown): Record<string, string> {
  const json = JSON.stringify(compact);
  const out: Record<string, string> = {};
  for (let i = 0, n = 0; i < json.length; i += BAG_CHUNK, n += 1) {
    out[n === 0 ? "lines" : `lines${n + 1}`] = json.slice(i, i + BAG_CHUNK);
  }
  return out;
}

export function bagFits(compact: unknown): boolean {
  return JSON.stringify(compact).length <= BAG_CHUNK * BAG_MAX_CHUNKS;
}

function joinBag(metadata: Stripe.Metadata | null): string {
  let json = metadata?.lines ?? "";
  for (let n = 2; metadata?.[`lines${n}`]; n += 1) json += metadata[`lines${n}`];
  return json;
}

/**
 * The bag for a session. Sessions created before the chunking fix carry a
 * truncated value that cannot be parsed; rather than lose a paid order, the
 * lines are rebuilt from what Stripe itself kept — the product name on each
 * line item, which is `${fragrance} — ${format}`.
 */
export async function bagLines(stripe: Stripe, session: Stripe.Checkout.Session): Promise<CompactLine[]> {
  const json = joinBag(session.metadata);
  if (json) {
    try {
      return JSON.parse(json) as CompactLine[];
    } catch {
      console.warn(`recordOrder: ${session.id} has truncated line metadata — rebuilding from Stripe line items`);
    }
  }
  return rebuildFromLineItems(stripe, session);
}

async function rebuildFromLineItems(stripe: Stripe, session: Stripe.Checkout.Session): Promise<CompactLine[]> {
  const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100, expand: ["data.price.product"] });
  const catalogue = await loadCatalogue();
  const byName = new Map([...catalogue.values()].map((f) => [f.name.trim().toLowerCase(), f]));
  const lines: CompactLine[] = [];
  for (const item of items.data) {
    const product = item.price?.product;
    const label = product && typeof product === "object" && "name" in product ? String(product.name ?? "") : (item.description ?? "");
    const [fragName, formatName] = label.split(" — ");
    const frag = byName.get((fragName ?? "").trim().toLowerCase());
    const def = FORMATS.find((f) => f.name === (formatName ?? "").trim());
    if (!frag || !def) continue; // anything that is not a catalogue line
    const description = product && typeof product === "object" && "description" in product ? String(product.description ?? "") : "";
    const engraved = description.match(/^Engraved\s+[“"](.+)[”"]$/)?.[1] ?? null;
    lines.push({ f: frag.id, k: def.key, q: item.quantity ?? 1, e: engraved, s: def.sizeMl, u: item.price?.unit_amount ?? 0 });
  }
  return lines;
}

/** Order: one row per bag line, keyed by the Checkout Session. */
export async function recordOrder(stripe: Stripe, db: SupabaseClient, session: Stripe.Checkout.Session): Promise<{ recorded: number }> {
  if (session.payment_status !== "paid") throw new Error("Payment is not paid");
  const lines = await bagLines(stripe, session);
  if (!lines.length) return { recorded: 0 };
  const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const customer = typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
  const rows = lines.map((l) => ({
    fragrance_id: l.f,
    user_id: session.metadata?.user_id || null,
    user_email: session.metadata?.user_email || session.customer_details?.email || null,
    contact_email: session.metadata?.contact_email || session.customer_details?.email || null,
    engraving: l.e,
    size_ml: l.s,
    charge_cents: l.u,
    payment_intent_id: piId,
    format: l.k,
    qty: l.q,
    // The card is charged at checkout, so the order is paid on arrival.
    status: "captured",
    checkout_session_id: session.id,
    stripe_customer_id: customer,
    delivery_method: session.metadata?.delivery_method === "alternate" ? "alternate" : "auspost",
    delivery_name: session.metadata?.delivery_name ?? null,
    delivery_phone: session.metadata?.delivery_phone ?? null,
    delivery_notes: session.metadata?.delivery_notes ?? null,
    // The address typed at checkout, or the one Stripe collected on its page.
    ship_address: session.metadata?.ship_address ?? session.customer_details?.address?.line1 ?? null,
    ship_city: session.metadata?.ship_city ?? session.customer_details?.address?.city ?? null,
    ship_region: session.metadata?.ship_region ?? session.customer_details?.address?.state ?? null,
    ship_postcode: session.metadata?.ship_postcode ?? session.customer_details?.address?.postal_code ?? null,
  }));
  const { data, error } = await db.rpc("record_paid_order", { p_session_id: session.id, p_rows: rows });
  if (error) throw new Error(error.message);
  return { recorded: Number(data ?? 0) };
}

/** Subscription: the row plus month 1, keyed by the Stripe subscription id. */
export async function recordSubscriptionStart(stripe: Stripe, db: SupabaseClient, session: Stripe.Checkout.Session): Promise<{ created: boolean }> {
  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!subId) return { created: false };
  const { data: already } = await db.from("scent_subscriptions").select("id").eq("stripe_subscription_id", subId).maybeSingle();
  if (already) return { created: false };
  const m = session.metadata ?? {};
  const customer = typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
  const months = Number(m.months) || 12;
  const { data: sub, error } = await db
    .from("scent_subscriptions")
    .insert({
      user_id: m.user_id,
      user_email: m.user_email || session.customer_details?.email || null,
      format: m.format,
      months,
      status: "active",
      pick_mode: m.pick_mode === "surprise" ? "surprise" : "choose",
      next_fragrance_id: m.fragrance_id || null,
      billing_fragrance_id: m.fragrance_id || null,
      stripe_subscription_id: subId,
      stripe_customer_id: customer,
    })
    .select("id")
    .single();
  if (error || !sub) throw new Error(error?.message ?? "could not create subscription");

  // Month 1 is the Checkout's first invoice.
  const invoiceId = typeof session.invoice === "string" ? session.invoice : (session.invoice?.id ?? null);
  let charge = session.amount_total ?? 0;
  let piId: string | null = null;
  if (invoiceId) {
    const inv = await stripe.invoices.retrieve(invoiceId);
    charge = inv.amount_paid ?? charge;
    piId = paymentIntentOf(inv);
  }
  await db.from("subscription_deliveries").upsert(
    { subscription_id: sub.id, month: 1, fragrance_id: m.fragrance_id, charge_cents: charge, payment_intent_id: piId, invoice_id: invoiceId },
    { onConflict: "invoice_id", ignoreDuplicates: true },
  );
  return { created: true };
}

function paymentIntentOf(inv: Stripe.Invoice): string | null {
  const anyInv = inv as unknown as { payment_intent?: string | { id: string } | null; payments?: { data?: { payment?: { payment_intent?: string | null } }[] } };
  if (typeof anyInv.payment_intent === "string") return anyInv.payment_intent;
  if (anyInv.payment_intent && typeof anyInv.payment_intent === "object") return anyInv.payment_intent.id;
  return anyInv.payments?.data?.[0]?.payment?.payment_intent ?? null;
}

interface SubRow {
  id: string;
  format: FormatKey;
  months: number;
  status: string;
  pick_mode: "choose" | "surprise";
  next_fragrance_id: string | null;
  billing_fragrance_id: string | null;
  stripe_subscription_id: string;
}

/**
 * Before a renewal: settle which scent the coming month is for (draw it in
 * surprise mode) and re-price the Stripe subscription to it.
 */
export async function prepareRenewal(stripe: Stripe, db: SupabaseClient, stripeSubId: string): Promise<void> {
  const { data } = await db.from("scent_subscriptions").select("id, format, months, status, pick_mode, next_fragrance_id, billing_fragrance_id, stripe_subscription_id").eq("stripe_subscription_id", stripeSubId).maybeSingle();
  const sub = data as SubRow | null;
  if (!sub || sub.status !== "active") return;
  let fragranceId = sub.next_fragrance_id;
  if (sub.pick_mode === "surprise") {
    const { data: drawn } = await db.rpc("draw_subscription_scent", { p_id: sub.id });
    if (typeof drawn === "string") fragranceId = drawn;
  }
  if (!fragranceId) return;
  const catalogue = await loadCatalogue();
  const frag = catalogue.get(fragranceId);
  if (!frag) return;
  const unit = memberPrice(frag, sub.format);
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
  const item = stripeSub.items.data[0];
  if (item && item.price.unit_amount !== unit) {
    await stripe.subscriptions.update(stripeSubId, {
      proration_behavior: "none",
      items: [{ id: item.id, price_data: { currency: CURRENCY, unit_amount: unit, recurring: { interval: "month" }, product: typeof item.price.product === "string" ? item.price.product : item.price.product.id } }],
    });
  }
  await db.from("scent_subscriptions").update({ billing_fragrance_id: fragranceId, next_fragrance_id: fragranceId }).eq("id", sub.id);
}

/** A paid renewal: record the month's delivery; end the term after the last one. */
export async function recordRenewal(stripe: Stripe, db: SupabaseClient, invoice: Stripe.Invoice): Promise<void> {
  const anyInv = invoice as unknown as { subscription?: string | { id: string } | null; parent?: { subscription_details?: { subscription?: string | { id: string } | null } } };
  const rawSub = anyInv.subscription ?? anyInv.parent?.subscription_details?.subscription ?? null;
  const stripeSubId = typeof rawSub === "string" ? rawSub : rawSub?.id;
  if (!stripeSubId) return;
  const { data } = await db.from("scent_subscriptions").select("id, format, months, status, pick_mode, next_fragrance_id, billing_fragrance_id, stripe_subscription_id").eq("stripe_subscription_id", stripeSubId).maybeSingle();
  const sub = data as SubRow | null;
  if (!sub) return;
  const { data: exists } = await db.from("subscription_deliveries").select("id").eq("invoice_id", invoice.id).maybeSingle();
  if (exists) return;
  const { data: prior } = await db.from("subscription_deliveries").select("month, fragrance_id").eq("subscription_id", sub.id);
  const month = (prior ?? []).reduce((m, d) => Math.max(m, d.month as number), 0) + 1;
  let fragranceId = sub.billing_fragrance_id ?? sub.next_fragrance_id;
  if (sub.pick_mode === "surprise" && (!fragranceId || (prior ?? []).some((d) => d.fragrance_id === fragranceId))) {
    const { data: drawn } = await db.rpc("draw_subscription_scent", { p_id: sub.id });
    if (typeof drawn === "string") fragranceId = drawn;
  }
  if (!fragranceId) return;
  await db.from("subscription_deliveries").insert({
    subscription_id: sub.id,
    month,
    fragrance_id: fragranceId,
    charge_cents: invoice.amount_paid ?? 0,
    payment_intent_id: paymentIntentOf(invoice),
    invoice_id: invoice.id,
  });
  const done = month >= sub.months;
  await db.from("scent_subscriptions").update({ next_fragrance_id: fragranceId, billing_fragrance_id: null, status: done ? "completed" : "active" }).eq("id", sub.id);
  if (done) {
    try {
      await stripe.subscriptions.cancel(stripeSubId);
    } catch {
      /* already ended */
    }
  }
}
