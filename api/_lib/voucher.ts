// Gift vouchers (/gift-card). Served by the existing checkout, webhook and
// confirm functions rather than their own: the Hobby plan allows 12.
//
//   buy     POST /api/stripe/checkout { kind: "voucher", … } → a Stripe Checkout
//           Session for the voucher's value (digital: no postage)
//   issue   on payment (webhook or confirm, whichever runs first): a one-time
//           Stripe coupon + promotion code worth the value, valid three years.
//           The shop's checkout already accepts promotion codes, so redeeming
//           needs nothing else. The card's details are recorded in
//           gift_vouchers and emailed to the buyer (and the recipient, if given).
//
// The code is derived from the Checkout Session with a keyed hash, so a retried
// issue — webhook and confirm racing, or a Stripe retry — produces the same
// code and the same idempotency keys, never a second coupon.

import { createHmac } from "node:crypto";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CURRENCY, json, siteUrl } from "./stripe.js";

export const VOUCHER_MIN = 10; // dollars
export const VOUCHER_MAX = 500;
const YEARS_VALID = 3; // Australian Consumer Law: at least three years
const LIMITS = { to: 36, from: 36, message: 115 } as const;

export type Finish = "obsidian" | "alabaster";

export interface Voucher {
  code: string;
  amountCents: number;
  finish: Finish;
  to: string;
  from: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** POST /api/stripe/checkout with kind "voucher": a Checkout Session for one voucher. */
export async function startVoucherCheckout(req: any, res: any, stripe: Stripe, body: Record<string, any>, user: { id: string; email: string | null } | null) {
  const dollars = Number(body.amount);
  if (!Number.isInteger(dollars) || dollars < VOUCHER_MIN || dollars > VOUCHER_MAX) {
    return json(res, 400, { error: `Choose a whole-dollar amount from $${VOUCHER_MIN} to $${VOUCHER_MAX}.` });
  }
  const finish: Finish = body.finish === "alabaster" ? "alabaster" : "obsidian";
  const to = clean(body.to, LIMITS.to);
  const from = clean(body.from, LIMITS.from);
  const message = clean(body.message, LIMITS.message);
  const email = clean(body.email, 200) || user?.email || "";
  if (!EMAIL_RE.test(email)) return json(res, 400, { error: "Enter your email — we send the voucher there." });
  const recipientEmail = clean(body.recipientEmail, 200);
  if (recipientEmail && !EMAIL_RE.test(recipientEmail)) return json(res, 400, { error: "That recipient email doesn't look right." });

  const site = siteUrl(req);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ui_mode: "hosted_page",
    customer_email: email,
    billing_address_collection: "auto",
    automatic_tax: { enabled: false },
    // A voucher can't be bought with another voucher.
    allow_promotion_codes: false,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: dollars * 100,
          product_data: {
            name: `Maison Obsidian Gift Voucher — ${money(dollars * 100)}`,
            description: `Digital gift voucher${to ? ` for ${to}` : ""}. Emailed with its code; valid for ${YEARS_VALID} years.`,
          },
        },
      },
    ],
    payment_intent_data: { metadata: { kind: "voucher", user_id: user?.id ?? "" } },
    metadata: {
      kind: "voucher",
      user_id: user?.id ?? "",
      user_email: email,
      amount: String(dollars),
      finish,
      to,
      from,
      message,
      ...(recipientEmail ? { recipient_email: recipientEmail } : {}),
    },
    success_url: `${site}/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/gift-card?cancelled=1`,
  });
  return json(res, 200, { url: session.url, sessionId: session.id });
}

/** MO-XXXX-XXXX from the session id: stable across retries, unguessable without the key. */
function codeFor(sessionId: string): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // no 0/O, 1/I/L, U
  const key = process.env.VOUCHER_SECRET || process.env.STRIPE_SECRET_KEY || "";
  const digest = createHmac("sha256", key).update(`voucher:${sessionId}`).digest();
  let s = "";
  for (let i = 0; i < 8; i += 1) s += alphabet[digest[i] % alphabet.length];
  return `MO-${s.slice(0, 4)}-${s.slice(4)}`;
}

function rowToVoucher(r: any): Voucher {
  return {
    code: r.code,
    amountCents: r.amount_cents,
    finish: r.finish === "alabaster" ? "alabaster" : "obsidian",
    to: r.to_name ?? "",
    from: r.from_name ?? "",
    message: r.message ?? "",
    issuedAt: r.issued_at,
    expiresAt: r.expires_at,
  };
}

/**
 * Issue the voucher for a paid session, once. Returns it either way, so the
 * thank-you page can show the card whichever path issued it.
 */
export interface EmailOutcome {
  sent: boolean;
  /** Why not, in words the owner can act on. */
  error?: string;
  to?: string[];
}

export async function issueVoucher(stripe: Stripe, db: SupabaseClient, session: Stripe.Checkout.Session): Promise<Voucher> {
  return (await issueVoucherRow(stripe, db, session)).voucher;
}

/**
 * Issue (once) and make sure it's emailed. The email is safe to repeat: Resend
 * de-duplicates on the idempotency key for 24 hours, so the thank-you page
 * calls this too and reports what actually happened, rather than trusting
 * that the webhook's attempt went through.
 */
export async function issueAndEmailVoucher(stripe: Stripe, db: SupabaseClient, session: Stripe.Checkout.Session): Promise<{ voucher: Voucher; email: EmailOutcome }> {
  const { voucher, buyer, recipient } = await issueVoucherRow(stripe, db, session);
  return { voucher, email: await emailVoucher(voucher, buyer, recipient, session.id) };
}

async function issueVoucherRow(stripe: Stripe, db: SupabaseClient, session: Stripe.Checkout.Session): Promise<{ voucher: Voucher; buyer: string | null; recipient: string | null; fresh: boolean }> {
  if (session.payment_status !== "paid") throw new Error("Payment is not paid");
  const { data: existing, error: readError } = await db.from("gift_vouchers").select("*").eq("checkout_session_id", session.id).maybeSingle();
  // Most often: migration 0039 hasn't been run, so the table doesn't exist.
  if (readError) throw new Error(`gift_vouchers: ${readError.message}`);
  if (existing) return { voucher: rowToVoucher(existing), buyer: existing.buyer_email, recipient: existing.recipient_email, fresh: false };

  const m = session.metadata ?? {};
  const amountCents = Number(m.amount) * 100;
  // The amount actually paid is the authority; metadata only says what was asked for.
  if (!Number.isFinite(amountCents) || amountCents <= 0 || (session.amount_total != null && session.amount_total !== amountCents)) {
    throw new Error(`voucher ${session.id}: paid ${session.amount_total} for ${m.amount}`);
  }
  const code = codeFor(session.id);
  const issued = new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000);
  const expires = new Date(issued);
  expires.setFullYear(expires.getFullYear() + YEARS_VALID);

  const coupon = await stripe.coupons.create(
    { amount_off: amountCents, currency: CURRENCY, duration: "once", name: `Gift voucher ${money(amountCents)}`, metadata: { kind: "voucher", checkout_session_id: session.id } },
    { idempotencyKey: `voucher-coupon-${session.id}` },
  );
  const promo = await stripe.promotionCodes.create(
    {
      promotion: { type: "coupon", coupon: coupon.id },
      code,
      max_redemptions: 1,
      expires_at: Math.floor(expires.getTime() / 1000),
      metadata: { kind: "voucher", checkout_session_id: session.id },
    },
    { idempotencyKey: `voucher-promo-${session.id}` },
  );

  const row = {
    checkout_session_id: session.id,
    code,
    amount_cents: amountCents,
    finish: m.finish === "alabaster" ? "alabaster" : "obsidian",
    to_name: m.to || null,
    from_name: m.from || null,
    message: m.message || null,
    buyer_email: m.user_email || session.customer_details?.email || null,
    recipient_email: m.recipient_email || null,
    stripe_coupon_id: coupon.id,
    stripe_promotion_code_id: promo.id,
    issued_at: issued.toISOString(),
    expires_at: expires.toISOString(),
  };
  const { data: inserted, error } = await db.from("gift_vouchers").upsert(row, { onConflict: "checkout_session_id", ignoreDuplicates: true }).select("*");
  if (error) throw new Error(`gift_vouchers: ${error.message}`);
  return { voucher: rowToVoucher(inserted?.[0] ?? row), buyer: row.buyer_email, recipient: row.recipient_email, fresh: !!inserted?.length };
}

/** For the webhook: issue, and email the first time it's issued. */
export async function issueVoucherFromWebhook(stripe: Stripe, db: SupabaseClient, session: Stripe.Checkout.Session): Promise<void> {
  const { voucher, buyer, recipient, fresh } = await issueVoucherRow(stripe, db, session);
  if (!fresh) return;
  const r = await emailVoucher(voucher, buyer, recipient, session.id);
  if (!r.sent) console.error(`voucher ${voucher.code}: not emailed — ${r.error}`);
}

/** The voucher by email: to the buyer, and to the recipient if they gave an address. */
async function emailVoucher(v: Voucher, buyer: string | null, recipient: string | null, sessionId: string): Promise<EmailOutcome> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RECOVERY_EMAIL_FROM;
  if (!key || !from) {
    const missing = [!key && "RESEND_API_KEY", !from && "RECOVERY_EMAIL_FROM"].filter(Boolean).join(", ");
    console.warn(`voucher ${v.code}: issued, but ${missing} not set — no email sent`);
    return { sent: false, error: `Email isn't set up — missing in Vercel: ${missing}` };
  }
  if (!buyer) return { sent: false, error: "No email address on the order" };
  // Fixed, not taken from the request: a repeat must send exactly the same body
  // for Resend's idempotency key to match.
  const site = process.env.SITE_URL?.replace(/\/+$/, "") || "https://www.maisonobsidian.com.au";
  const expiry = new Date(v.expiresAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const card = (lead: string) => `<div style="font-family:Georgia,serif;color:#1a1a1f;max-width:560px;line-height:1.6">
<p>${esc(lead)}</p>
<div style="background:#0b0b0d;color:#f3ecdc;border:1px solid #c9a961;padding:28px 24px;text-align:center;margin:18px 0">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.3em;color:#c9a961">MAISON OBSIDIAN · GIFT VOUCHER</div>
<div style="font-size:44px;color:#e6c989;margin:10px 0 4px">${money(v.amountCents)} <span style="font-size:13px;letter-spacing:0.2em">AUD</span></div>
${v.to ? `<div style="font-size:13px;letter-spacing:0.2em;color:#c9a961;margin-top:8px">PRESENTED TO</div><div style="font-size:22px">${esc(v.to)}</div>` : ""}
${v.message ? `<p style="font-style:italic;color:#d9cfb8;margin:12px 0 0">“${esc(v.message)}”</p>` : ""}
${v.from ? `<p style="font-size:13px;color:#b7ad97;margin:12px 0 0">From ${esc(v.from)}</p>` : ""}
<div style="margin:18px auto 0;border:1px solid #c9a961;display:inline-block;padding:10px 18px;font-family:Helvetica,Arial,sans-serif;font-size:20px;letter-spacing:0.18em;color:#e6c989">${esc(v.code)}</div>
</div>
<p>To use it, shop at <a href="${esc(site)}" style="color:#7a5f26">maisonobsidian.com.au</a> and enter <strong>${esc(v.code)}</strong> as the promotion code on the payment page. It's for one order, until ${esc(expiry)}.</p>
<p style="font-size:13px;color:#666">Not redeemable for cash. Questions? Just reply to this email.</p>
<p>Maison Obsidian</p>
</div>`;
  const text = (lead: string) =>
    [lead, "", `Maison Obsidian gift voucher: ${money(v.amountCents)} AUD`, v.to ? `To: ${v.to}` : "", v.from ? `From: ${v.from}` : "", v.message ? `“${v.message}”` : "", "", `Code: ${v.code}`, "", `Enter the code as the promotion code on the payment page at ${site}. One order, until ${expiry}. Not redeemable for cash.`, "", "Maison Obsidian"]
      .filter((l, i, a) => l !== "" || a[i - 1] !== "")
      .join("\n");
  const send = async (to: string, subject: string, lead: string, tag: string): Promise<string | null> => {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `voucher-${tag}-${sessionId}` },
        body: JSON.stringify({ from, to: [to], subject, text: text(lead), html: card(lead), ...(process.env.RECOVERY_REPLY_TO ? { reply_to: process.env.RECOVERY_REPLY_TO } : {}) }),
      });
      // 409: this exact email was already sent under the same key (the webhook got there first).
      if (r.ok || r.status === 409) return null;
      const detail = (await r.text()).slice(0, 300);
      console.error(`voucher ${v.code}: email to ${tag} failed — Resend ${r.status}: ${detail}`);
      let message = detail;
      try {
        message = (JSON.parse(detail) as { message?: string }).message ?? detail;
      } catch {
        /* not JSON */
      }
      return `Resend refused it (${r.status}): ${message}`;
    } catch (e) {
      return `Couldn't reach Resend: ${e instanceof Error ? e.message : String(e)}`;
    }
  };
  const sentTo: string[] = [];
  const buyerError = await send(buyer, `Your Maison Obsidian gift voucher — ${money(v.amountCents)}`, `Thank you. Here is the gift voucher you bought${v.to ? ` for ${v.to}` : ""} — forward this email or print it from the page you bought it on.`, "buyer");
  if (buyerError) return { sent: false, error: buyerError };
  sentTo.push(buyer);
  if (recipient && recipient.toLowerCase() !== buyer.toLowerCase()) {
    const recipientError = await send(recipient, `${v.from || "Someone"} sent you a Maison Obsidian gift voucher`, `${v.from || "Someone"} has sent you a Maison Obsidian gift voucher.`, "recipient");
    if (recipientError) return { sent: false, error: `Sent to you, but not to ${recipient}: ${recipientError}`, to: sentTo };
    sentTo.push(recipient);
  }
  return { sent: true, to: sentTo };
}
