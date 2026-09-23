// Abandoned checkout recovery.
//
// Stripe's own recovery emails depend on promotional-consent collection, which
// Stripe offers to US merchants only, so the house sends the reminder itself.
// A checkout is created with a recovery URL (after_expiration.recovery) and,
// if the shopper ticked "email me a reminder", metadata.remind = "1". When the
// session expires unpaid, the webhook calls sendRecoveryEmail(): one email,
// through Resend, with the link back to the same bag.
//
// Env (Vercel):
//   RESEND_API_KEY        — without it no email is sent (logged instead)
//   RECOVERY_EMAIL_FROM   — e.g. "Maison Obsidian <hello@maisonobsidian.com.au>",
//                           a sender on a domain verified in Resend
//   RECOVERY_REPLY_TO     — optional; where "unsubscribe" replies go

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A recovered session is a new session made from an expired one. If Stripe
 * didn't carry the original's metadata across, take it from the original, so
 * the bag, the delivery details and kind: "order" survive the round trip.
 */
export async function withOriginalMetadata(stripe: Stripe, session: Stripe.Checkout.Session): Promise<Stripe.Checkout.Session> {
  if (!session.recovered_from || session.metadata?.kind) return session;
  const original = await stripe.checkout.sessions.retrieve(session.recovered_from);
  return { ...session, metadata: { ...(original.metadata ?? {}), ...(session.metadata ?? {}) } };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendRecoveryEmail(stripe: Stripe, db: SupabaseClient, session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== "payment" || session.metadata?.kind !== "order" || session.metadata?.remind !== "1") return;
  const url = session.after_expiration?.recovery?.url;
  const email = session.metadata?.contact_email || session.customer_details?.email || session.customer_email || session.metadata?.user_email;
  if (!url || !email) return;

  // Bought since in another checkout? Then there is nothing to recover.
  const since = new Date(session.created * 1000).toISOString();
  // ilike for case, with its wildcards escaped so it compares exactly.
  const exact = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  for (const column of ["contact_email", "user_email"]) {
    const { data: bought } = await db.from("commits").select("id").ilike(column, exact).gte("created_at", since).limit(1);
    if (bought?.length) return;
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.RECOVERY_EMAIL_FROM;
  if (!key || !from) {
    console.warn(`recovery: ${session.id} expired with a reminder requested, but RESEND_API_KEY / RECOVERY_EMAIL_FROM are not set`);
    return;
  }

  const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 20 });
  const names = items.data.map((i) => `${i.quantity ?? 1} × ${i.description ?? "Item"}`);
  const name = session.metadata?.delivery_name?.split(" ")[0];
  const greeting = name ? `Hi ${name},` : "Hi,";
  const text = [
    greeting,
    "",
    "You asked us to remind you if you didn't finish checking out. Your bag is saved:",
    "",
    ...names.map((n) => `  ${n}`),
    "",
    `Pick up where you left off: ${url}`,
    "",
    "This is the only reminder we'll send about this bag. Reply \"unsubscribe\" and we won't email you reminders again.",
    "",
    "Maison Obsidian",
  ].join("\n");
  const html = `<div style="font-family:Georgia,serif;color:#1a1a1f;max-width:520px;line-height:1.6">
<p>${esc(greeting)}</p>
<p>You asked us to remind you if you didn't finish checking out. Your bag is saved:</p>
<ul>${names.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
<p><a href="${esc(url)}" style="display:inline-block;background:#c9a961;color:#0b0b0d;padding:12px 22px;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:0.12em;text-transform:uppercase">Return to your bag</a></p>
<p style="font-size:13px;color:#666">This is the only reminder we'll send about this bag. Reply "unsubscribe" and we won't email you reminders again.</p>
<p>Maison Obsidian</p>
</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // Stripe retries webhooks; one session, one email.
      "Idempotency-Key": `recovery-${session.id}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your bag is waiting",
      text,
      html,
      ...(process.env.RECOVERY_REPLY_TO ? { reply_to: process.env.RECOVERY_REPLY_TO } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
