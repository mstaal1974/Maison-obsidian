// Vercel serverless function — drafts a marketing note for an audience segment
// with Claude. Admin-only: the caller's Supabase token must pass is_admin().
//
// The console sends the segment (who they are, what they love, what's new)
// and gets back a subject line, preview text and a short email body in the
// house voice. Nothing personal leaves the console beyond the aggregate
// description of the segment.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const SYSTEM = `You write customer emails for Maison Obsidian, a boutique batch-atelier fragrance house.
Voice: warm, precise, quietly luxurious — an in-the-know concierge writing to a regular, never a marketer shouting. British/Australian spelling. No exclamation marks, no emoji, no "limited time" pressure.
The house: scents inspired by designer references, poured in small batches when a batch fills; formats are 10/30/50 ml Eau de Parfum and a car diffuser; the Monthly Pour is a 12-month subscription at 10% under shelf price, choose-your-own or surprise.
Write for the segment described. Mention at most two fragrances, by their exact catalogue names. Keep the body under 130 words with a single clear next step. Return JSON only.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "preview", "body"],
  properties: {
    subject: { type: "string", description: "Subject line, under 60 characters" },
    preview: { type: "string", description: "Inbox preview text, under 90 characters" },
    body: { type: "string", description: "Email body, plain text, under 130 words, paragraphs separated by blank lines" },
  },
} as const;

async function adminGate(req: any): Promise<number | null> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return null; // offline demo — no accounts to check
  const auth = String(req.headers["authorization"] ?? "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return 401;
  try {
    const sb = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.rpc("is_admin");
    if (error) return 401;
    return data === true ? null : 403;
  } catch {
    return 401;
  }
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: "AI drafting isn't configured (ANTHROPIC_API_KEY missing)" });
    return;
  }
  const gate = await adminGate(req);
  if (gate !== null) {
    res.status(gate).json({ error: gate === 401 ? "Sign in as an admin" : "Admins only" });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const segment = str(body.segment, 600);
  const angle = str(body.angle, 300);
  const scents = str(body.scents, 400);
  if (!segment) {
    res.status(400).json({ error: "Describe the segment" });
    return;
  }
  const user =
    `Segment: ${segment}\n` +
    (scents ? `Fragrances they gravitate to (exact catalogue names): ${scents}\n` : "") +
    (angle ? `What this note is about: ${angle}\n` : "Occasion: a considered check-in — something new in the house that fits them.\n") +
    "Write the note as JSON.";

  const client = new Anthropic({ apiKey });
  res.setHeader("Cache-Control", "no-store");
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") {
      res.status(422).json({ error: "The model declined to write this note" });
      return;
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const draft = JSON.parse(text) as { subject: string; preview: string; body: string };
    res.status(200).json({ draft, model: response.model });
  } catch (err) {
    console.error("marketing error:", err);
    if (err instanceof Anthropic.RateLimitError) res.status(429).json({ error: "rate_limited", retryAfter: 20 });
    else if (err instanceof Anthropic.AuthenticationError) res.status(501).json({ error: "AI drafting is misconfigured (invalid API key)" });
    else res.status(502).json({ error: "Could not draft the note" });
  }
}
