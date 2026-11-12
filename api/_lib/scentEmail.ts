// POST /api/scent-ai { op: "email-result", … } — public. (Served by the
// scent-ai function rather than its own: the Hobby plan allows 12.) Emails a
// Scent DNA result to the address the visitor attached to it on /discover.
//
// The address is never taken from this request: it is read from the saved
// Scentprint row (scent_profiles.email, written by attach_scentprint_email or
// save_scentprint), so this cannot be pointed at anybody else's inbox with
// different words. Each result is emailed once (result_emailed_at), fragrance
// names, links and prices come from the catalogue, and the only text the client
// supplies — the Scentprint's name — is length- and character-checked.
//
// Body: { op: "email-result", code, identity: { primary, secondary }, matches: [{ slug, percent }] }
// Env: RESEND_API_KEY, RECOVERY_EMAIL_FROM (the house sender), RECOVERY_REPLY_TO
// optional, SITE_URL for links, SUPABASE_SERVICE_ROLE_KEY to read and stamp the row.

import { json, loadCatalogue, readBody, serviceClient, siteUrl } from "./stripe.js";
import { type CatalogueItem, buyable, formatPrice } from "./catalogue.js";

const BOX_PRICE = 5000;
const BOX_SIZE = 5;

// A few per visitor every ten minutes: enough for a typo and a retry.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 4;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** The Scentprint's name ("Luminous Woods"): short, letters and a little punctuation. */
function label(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim().replace(/\s+/g, " ");
  return s.length <= 48 && /^[\p{L}\p{N} '’&·,.-]+$/u.test(s) ? s : "";
}

export async function emailScentResult(req: any, res: any, ip: string) {
  if (limited(ip)) return json(res, 429, { error: "rate_limited" });
  const db = serviceClient();
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RECOVERY_EMAIL_FROM;
  if (!db || !key || !from) {
    const missing = [!db && "SUPABASE_SERVICE_ROLE_KEY", !key && "RESEND_API_KEY", !from && "RECOVERY_EMAIL_FROM"].filter(Boolean);
    console.warn(`[scent/email] not configured: missing ${missing.join(", ")}`);
    return json(res, 501, { error: "Email isn't configured" });
  }

  const body = readBody(req);
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!/^[0-9A-Z]{6}$/.test(code)) return json(res, 400, { error: "Unknown result" });
  const primary = label(body.identity?.primary);
  const secondary = label(body.identity?.secondary);

  // Matches: catalogue fragrances only, in the order given, five at most.
  const catalogue = await loadCatalogue();
  const bySlug = new Map<string, CatalogueItem>([...catalogue.values()].map((f) => [f.slug, f]));
  const seen = new Set<string>();
  const matches: { frag: CatalogueItem; percent: number }[] = [];
  for (const m of Array.isArray(body.matches) ? body.matches.slice(0, BOX_SIZE) : []) {
    const frag = typeof m?.slug === "string" ? bySlug.get(m.slug) : undefined;
    if (!frag || seen.has(frag.slug) || frag.vipOnly) continue;
    seen.add(frag.slug);
    const percent = Number.isFinite(m.percent) ? Math.max(0, Math.min(100, Math.round(m.percent))) : 0;
    matches.push({ frag, percent });
  }
  if (!matches.length) return json(res, 400, { error: "No matches to send" });

  // Claim the row: it must have an address and not have been emailed yet.
  const { data: claimed, error: claimError } = await db
    .from("scent_profiles")
    .update({ result_emailed_at: new Date().toISOString() })
    .eq("code", code)
    .not("email", "is", null)
    .is("result_emailed_at", null)
    .select("email")
    .maybeSingle();
  if (claimError) {
    console.error("[scent/email] claim", claimError.message);
    return json(res, 500, { error: "Could not send" });
  }
  if (!claimed?.email) return json(res, 409, { error: "Already sent, or no address on this result" });

  const site = siteUrl(req);
  const resultUrl = `${site}/scent/${code}`;
  const productUrl = (f: CatalogueItem, format?: string) => `${site}/fragrance/${encodeURIComponent(f.slug)}${format ? `?format=${format}` : ""}`;
  const box = matches.length === BOX_SIZE && matches.every((m) => buyable(m.frag, "perf10")) ? matches : null;
  const singles = box ? box.reduce((n, m) => n + formatPrice(m.frag, "perf10"), 0) : 0;
  const saving = singles - BOX_PRICE;
  const car = matches.find((m) => buyable(m.frag, "car"))?.frag ?? null;

  const title = primary ? `Your Scent DNA: ${primary}` : "Your Scent DNA";
  const lines = matches.map((m, i) => `${i + 1}. ${m.frag.name} — ${m.percent}% match`);
  const text = [
    "Hi,",
    "",
    `Here is your Scent DNA result, as you asked.${primary ? ` You are ${primary}${secondary ? ` — ${secondary}` : ""}.` : ""}`,
    "",
    "Your closest matches:",
    ...lines,
    "",
    ...(box
      ? [`Try all five: a Discovery Box of your matches, 5 × 10 ml for ${money(BOX_PRICE)}${saving > 0 ? ` (save ${money(saving)})` : ""}.`, `Add it here: ${resultUrl}`, ""]
      : [`See your full result: ${resultUrl}`, ""]),
    ...(car ? [`Wear ${car.name} in the car too — a hanging car diffuser for ${money(formatPrice(car, "car"))}: ${productUrl(car, "car")}`, ""] : []),
    "Your link reopens your full result on any device.",
    "",
    "You asked us to email you this result; it's the only email we'll send about it.",
    "",
    "Maison Obsidian",
  ].join("\n");

  const button = (href: string, text: string) =>
    `<a href="${esc(href)}" style="display:inline-block;background:#c9a961;color:#0b0b0d;padding:13px 22px;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">${esc(text)}</a>`;
  const html = `<div style="font-family:Georgia,serif;color:#1a1a1f;max-width:560px;line-height:1.6">
<p style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7a5f26;margin:0">Your Scent DNA</p>
${primary ? `<h1 style="font-weight:400;font-size:34px;line-height:1.1;margin:8px 0 0">${esc(primary)}</h1>` : ""}
${secondary ? `<p style="font-style:italic;font-size:19px;color:#7a5f26;margin:4px 0 0">${esc(secondary)}</p>` : ""}
<p style="margin:20px 0 8px">Your closest matches:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:16px">
${matches
  .map(
    (m, i) => `<tr><td style="padding:10px 0;border-top:1px solid #e6dfd2;color:#9a8f80;width:28px">${i + 1}</td><td style="padding:10px 0;border-top:1px solid #e6dfd2"><a href="${esc(productUrl(m.frag))}" style="color:#1a1a1f">${esc(m.frag.name)}</a></td><td style="padding:10px 0;border-top:1px solid #e6dfd2;text-align:right;font-family:Helvetica,Arial,sans-serif;color:#7a5f26">${m.percent}%</td></tr>`,
  )
  .join("\n")}
</table>
${
  box
    ? `<div style="margin:24px 0 0;padding:20px;background:#f7f3eb;border:1px solid #c9a961">
<p style="margin:0;font-size:20px">Try all five: your Discovery Box</p>
<p style="margin:6px 0 14px;font-size:15px;color:#4a4136">5 × 10 ml of your matches for ${money(BOX_PRICE)}${saving > 0 ? ` — save ${money(saving)} on singles` : ""}.</p>
${button(resultUrl, `Add my 5 · ${money(BOX_PRICE)}`)}
</div>`
    : `<p style="margin:24px 0 0">${button(resultUrl, "See my full result")}</p>`
}
${car ? `<p style="margin:22px 0 0;font-size:15px">Wear ${esc(car.name)} in the car too — <a href="${esc(productUrl(car, "car"))}" style="color:#7a5f26">a hanging car diffuser for ${money(formatPrice(car, "car"))}</a>.</p>` : ""}
<p style="margin:22px 0 0;font-size:13px;color:#666">Your link reopens your full result on any device. You asked us to email you this result; it's the only email we'll send about it.</p>
<p>Maison Obsidian</p>
</div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `scent-result-${code}` },
    body: JSON.stringify({
      from,
      to: [claimed.email],
      subject: title,
      text,
      html,
      ...(process.env.RECOVERY_REPLY_TO ? { reply_to: process.env.RECOVERY_REPLY_TO } : {}),
    }),
  });
  if (!r.ok) {
    console.error(`[scent/email] Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
    // Release the claim so a retry can send it.
    await db.from("scent_profiles").update({ result_emailed_at: null }).eq("code", code);
    return json(res, 502, { error: "The email didn't send" });
  }
  return json(res, 200, { sent: true });
}
