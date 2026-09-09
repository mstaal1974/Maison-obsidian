// Vercel serverless function — Maison Obsidian concierge, powered by Claude.
//
// The Anthropic API key stays server-side (ANTHROPIC_API_KEY in the Vercel
// project settings) and is never exposed to the browser. The client POSTs the
// conversation plus a compact live catalogue summary; we prepend a house system
// prompt and stream Claude's reply back as plain text.
//
// Set ANTHROPIC_API_KEY in Vercel → Project → Settings → Environment Variables.
// Without it the endpoint returns 501 and the client falls back to a local
// concierge so the demo still answers.

import Anthropic from "@anthropic-ai/sdk";

export const config = { runtime: "nodejs" };

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const BRAND = `You are the concierge for Maison Obsidian, a boutique atelier fragrance house.
Voice: warm, precise, quietly luxurious — an in-the-know shop concierge, never pushy. Keep replies short (2–4 sentences unless asked for more). Respond directly with your final answer only; do not include exploratory reasoning.

How the house works:
- Buying: a normal online store. Checkout is handled by Stripe and the card is charged at the time of purchase. Every bottle is poured in small numbers and filled to order; orders ship within 5-7 business days, free over $100, 30-day returns.
- Sizes & pricing: every fragrance comes in 10 ml, 30 ml, and 50 ml (prices in the catalogue below). 30% extrait concentration.
- Custom engraving: up to 28 characters on the bottle label, previewed live on the product page.
- VIP Club ($120/yr): early access to locked releases, re-pour priority, complimentary engraving. Some scents are VIP-only.
- The Monthly Pour: a 12-month subscription in 10/30/50 ml or the car diffuser, one fragrance a month at 10% under shelf price, billed monthly. The customer picks each month's scent or lets the house surprise them; cancel any time.
- Shipping: Australia Post Parcel Post; customers see status + tracking under "My Orders".
- Accounts: sign in (email or Google) to check out, track orders, and join VIP.

Guidance: recommend from the catalogue below by notes, inspiration, or gender when asked. When you mention a fragrance, write its name EXACTLY as it appears in the catalogue (the app turns exact names into clickable product links). If asked something you don't know (order-specific details, stock for a size), say so and point them to the relevant page (the Vault, a product page, or My Reservations). Never invent prices, scents, or policies.`;

function buildSystem(catalogue?: string, profile?: string): string {
  const cat = catalogue && catalogue.trim().slice(0, 8000);
  // Only present when the signed-in customer opted in to personalisation; the
  // client never sends it otherwise. Kept after the catalogue so the stable
  // prefix stays cacheable.
  const who = typeof profile === "string" && profile.trim() ? profile.trim().slice(0, 1200) : "";
  let system = cat ? `${BRAND}\n\nCurrent catalogue:\n${cat}` : BRAND;
  if (who) {
    system += `\n\nAbout this customer (they opted in to personalised suggestions; use it to tailor what you recommend and to reference what they already own, but don't recite it back unless asked): ${who}`;
  }
  return system;
}

// ─── Best-effort per-IP rate limit ───────────────────────────────────────────
// In-memory sliding window. Serverless instances aren't shared, so this bounds
// abuse per warm instance rather than globally — for strict distributed limits,
// back it with Upstash/Redis or a Supabase table. Good enough to stop a single
// client hammering the endpoint.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function retryAfterSeconds(ip: string): number {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000));
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    // opportunistic cleanup of stale IPs
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return 0;
}

function clientIp(req: any): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : (fwd ?? "").split(",")[0];
  return (first || req.socket?.remoteAddress || "unknown").trim();
}

function sanitize(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  const cleaned = messages
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-12);
  // The Messages API requires the first turn to be from the user.
  while (cleaned.length && cleaned[0].role !== "user") cleaned.shift();
  return cleaned;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: "Concierge is not configured" });
    return;
  }

  const retry = retryAfterSeconds(clientIp(req));
  if (retry > 0) {
    res.setHeader("Retry-After", String(retry));
    res.status(429).json({ error: "rate_limited", retryAfter: retry });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const messages = sanitize(body.messages);
  if (messages.length === 0) {
    res.status(400).json({ error: "No messages" });
    return;
  }

  const client = new Anthropic({ apiKey });

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      thinking: { type: "disabled" }, // snappy concierge; system prompt keeps it to a final answer
      system: buildSystem(body.catalogue, body.profile),
      messages,
    });
    stream.on("text", (delta: string) => res.write(delta));
    await stream.finalMessage();
    res.end();
  } catch (err) {
    // If nothing has been written yet, surface an error status; otherwise close.
    if (!res.headersSent || !res.writableEnded) {
      try {
        res.write("");
      } catch {
        /* ignore */
      }
    }
    res.end();
    console.error("chat error:", err);
  }
}
