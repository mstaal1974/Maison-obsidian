// POST /api/waitlist/notify — admin only. Emails everyone on a waitlist that
// what they asked about has arrived: a fragrance on its launch day (format
// null) or a format that has gone from Coming soon to live. One email each;
// every row is stamped notified_at so a second press sends nothing new.
//
// Body: { fragranceId: string, format: FormatKey | null }
// Env: RESEND_API_KEY, RECOVERY_EMAIL_FROM (the same sender as the checkout
// reminders), RECOVERY_REPLY_TO optional, SITE_URL for the link,
// SUPABASE_SERVICE_ROLE_KEY to read and stamp the list.

import { createHash } from "node:crypto";
import { isAdminRequest, json, loadCatalogue, readBody, serviceClient, siteUrl } from "../_lib/stripe.js";
import { type FormatKey, FORMAT_BY_KEY, formatStatus, launched } from "../_lib/catalogue.js";

export const config = { runtime: "nodejs", maxDuration: 60 };

// Resend's batch endpoint takes up to 100 emails a call.
const BATCH = 100;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!(await isAdminRequest(req))) return json(res, 403, { error: "Admins only" });
  try {
    const db = serviceClient();
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RECOVERY_EMAIL_FROM;
    if (!db || !key || !from) {
      const missing = [!db && "SUPABASE_SERVICE_ROLE_KEY", !key && "RESEND_API_KEY", !from && "RECOVERY_EMAIL_FROM"].filter(Boolean);
      return json(res, 501, { error: "Waitlist email isn't configured", detail: `Missing in Vercel: ${missing.join(", ")}` });
    }

    const body = readBody(req);
    const fragranceId = typeof body.fragranceId === "string" ? body.fragranceId : "";
    const format: FormatKey | null = typeof body.format === "string" && body.format in FORMAT_BY_KEY ? (body.format as FormatKey) : null;
    const frag = (await loadCatalogue()).get(fragranceId);
    if (!frag) return json(res, 400, { error: "Unknown fragrance" });

    // Only once it is really here: the launch date has passed, or the format is live.
    if (!launched(frag)) return json(res, 409, { error: `${frag.name} hasn't launched yet` });
    if (format && formatStatus(frag, format) !== "live") return json(res, 409, { error: `${frag.name} ${FORMAT_BY_KEY[format].name} isn't live yet` });

    let q = db.from("waitlist").select("id, email").eq("fragrance_id", frag.id).is("notified_at", null).order("created_at").limit(1000);
    q = format ? q.eq("format", format) : q.is("format", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    if (!rows?.length) return json(res, 200, { sent: 0, failed: 0 });

    const what = format ? `${frag.name} ${FORMAT_BY_KEY[format].name}` : frag.name;
    const link = `${siteUrl(req)}/fragrance/${encodeURIComponent(frag.slug)}`;
    const subject = format ? `${what} is here` : `${frag.name} has been poured`;
    const lead = format ? `You asked us to tell you when the ${what} arrived. It's here.` : `You asked us to tell you when ${frag.name} was poured. It's here.`;
    const text = [
      "Hi,",
      "",
      lead,
      "",
      `See it: ${link}`,
      "",
      "This is the one email you signed up for, and the only one we'll send about it.",
      "",
      "Maison Obsidian",
    ].join("\n");
    const html = `<div style="font-family:Georgia,serif;color:#1a1a1f;max-width:520px;line-height:1.6">
<p>Hi,</p>
<p>${esc(lead)}</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#c9a961;color:#0b0b0d;padding:12px 22px;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:0.12em;text-transform:uppercase">See ${esc(what)}</a></p>
<p style="font-size:13px;color:#666">This is the one email you signed up for, and the only one we'll send about it.</p>
<p>Maison Obsidian</p>
</div>`;
    const replyTo = process.env.RECOVERY_REPLY_TO ? { reply_to: process.env.RECOVERY_REPLY_TO } : {};

    let sent = 0;
    let failed = 0;
    let lastError = "";
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH) as { id: string; email: string }[];
      // Same rows, same key: a retried press can't send a chunk twice.
      const idem = createHash("sha256").update(chunk.map((r) => r.id).join(",")).digest("hex");
      const r = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `waitlist-${idem}` },
        body: JSON.stringify(chunk.map((row) => ({ from, to: [row.email], subject, text, html, ...replyTo }))),
      });
      if (!r.ok) {
        failed += chunk.length;
        lastError = `Resend ${r.status}: ${(await r.text()).slice(0, 200)}`;
        console.error("[waitlist/notify]", lastError);
        continue;
      }
      const { error: stampError } = await db.from("waitlist").update({ notified_at: new Date().toISOString() }).in("id", chunk.map((row) => row.id));
      if (stampError) console.error("[waitlist/notify] sent but not stamped", stampError.message);
      sent += chunk.length;
    }
    if (!sent && failed) return json(res, 502, { error: "No emails were sent", detail: lastError });
    return json(res, 200, { sent, failed, ...(lastError ? { detail: lastError } : {}) });
  } catch (e) {
    console.error("[waitlist/notify]", e);
    return json(res, 500, { error: "The waitlist email failed", detail: e instanceof Error ? e.message : String(e) });
  }
}
