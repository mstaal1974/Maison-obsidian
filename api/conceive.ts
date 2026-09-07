// Vercel serverless function — Maison Obsidian AI fragrance conception.
//
// Given the name of a reference fragrance (e.g. "Tom Ford Black Lacquer"), asks
// Claude for a market-ready house name, marketing/packaging copy and a
// top/heart/base olfactory breakdown, returned as validated JSON the admin
// console drops straight into the "New fragrance" form.
//
// The Anthropic key stays server-side (ANTHROPIC_API_KEY). When Supabase is
// configured on the server (SUPABASE_URL / SUPABASE_ANON_KEY, or the VITE_-
// prefixed pair Vercel already has), the caller must present a Supabase access
// token that passes is_admin(); otherwise (offline demo) the endpoint is open
// but rate-limited like /api/chat.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

export type Gender = "masculine" | "feminine" | "unisex";

export interface Conception {
  name: string;
  alternates: string[];
  slug: string;
  profile: string[];
  family: string;
  gender: Gender;
  inspiration: string; // "Inspired by Brand - Fragrance" (house convention)
  tagline: string;
  story: string;
  copy: string;
  top: string[];
  heart: string[];
  base: string[];
  liquid: string;
  accent: string;
  experience: string[];
}

const FAMILIES = [
  "Woody",
  "Amber",
  "Floral",
  "Fresh",
  "Citrus",
  "Gourmand",
  "Spicy",
  "Aromatic",
  "Leather",
  "Chypre",
  "Aquatic",
  "Green",
] as const;

// Structured-output schema. Every object closes additionalProperties and lists
// all keys as required, as the Messages API requires for json_schema formats.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "alternates",
    "profile",
    "family",
    "gender",
    "inspiration_brand",
    "inspiration_fragrance",
    "tagline",
    "story",
    "copy",
    "top",
    "heart",
    "base",
    "liquid",
    "accent",
    "experience",
  ],
  properties: {
    name: {
      type: "string",
      description:
        "The Maison Obsidian house name for this scent. Two evocative words, Title Case, no brand names, no trademarked terms, not already in the house catalogue.",
    },
    alternates: {
      type: "array",
      description: "Exactly three alternative house names in the same style, in case the first is taken.",
      items: { type: "string" },
    },
    profile: {
      type: "array",
      description: "Exactly three single-word scent descriptors in Title Case, e.g. Dark, Resinous, Woody.",
      items: { type: "string" },
    },
    family: { type: "string", enum: [...FAMILIES] },
    gender: { type: "string", enum: ["masculine", "feminine", "unisex"] },
    inspiration_brand: { type: "string", description: "The reference house, e.g. Tom Ford." },
    inspiration_fragrance: { type: "string", description: "The reference fragrance name, e.g. Black Lacquer." },
    tagline: {
      type: "string",
      description: "Three headline notes as a comma-separated list ending with a full stop, e.g. 'Black Ink, Leather, Ebony Wood.'",
    },
    story: {
      type: "string",
      description: "One-sentence catalogue summary (18-30 words) in the house voice: precise, quietly luxurious, a little mysterious.",
    },
    copy: {
      type: "string",
      description:
        "Packaging / marketing copy of 60-90 words in two short paragraphs separated by a blank line. Evocative, sensory, never mentions the reference brand.",
    },
    top: { type: "array", description: "Two or three top notes.", items: { type: "string" } },
    heart: { type: "array", description: "Two or three heart notes.", items: { type: "string" } },
    base: { type: "array", description: "Two or three base notes.", items: { type: "string" } },
    liquid: { type: "string", description: "Hex colour (#rrggbb) of the juice as seen through the bottle. Deep, muted." },
    accent: { type: "string", description: "Hex colour (#rrggbb) for the product-page glow; warm metallic, harmonious with the liquid." },
    experience: {
      type: "array",
      description: "Three to five single-word experience tags, e.g. Warm, Evening, Statement, Woody, Intense.",
      items: { type: "string" },
    },
  },
} as const;

const SYSTEM = `You are the creative director and master perfumer of Maison Obsidian, a boutique batch-atelier fragrance house.
Voice: warm, precise, quietly luxurious, slightly mysterious. Never cheesy, never generic.

Given a reference fragrance the atelier has sourced an interpretation of, you produce:
1. Brand conception — a market-ready Maison Obsidian name tailored to the scent's profile. Two words, Title Case. Draw on materials, light, minerals, weather, places and moods (house examples: Smoky Obsidian, Velvet Absolute, Golden Aura, Midnight Velvet, Fiery Spice, Azure Edge, Desert Nomad). Never reuse the reference brand or fragrance name, never use trademarked words, and avoid any name already in the house catalogue.
2. Copywriting — a three-note tagline, a one-sentence catalogue story, and 60-90 words of packaging copy. The copy never names the reference brand; the "inspired by" attribution is shown separately.
3. Olfactory breakdown — the scent deconstructed into top, heart and base notes that faithfully reflect the reference fragrance's published pyramid, using standard perfumery note names.

Also classify the olfactory family and gender positioning, propose juice and accent colours that suit the composition, and give experience tags.
If the reference is not a fragrance you recognise, infer a plausible profile from its name and brand rather than refusing, and choose notes typical of that house's style.`;

// ─── Best-effort per-IP rate limit (same shape as /api/chat) ─────────────────
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
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
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return 0;
}

function clientIp(req: any): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : (fwd ?? "").split(",")[0];
  return (first || req.socket?.remoteAddress || "unknown").trim();
}

// ─── Admin guard ─────────────────────────────────────────────────────────────
// Returns null when the caller may proceed, otherwise an HTTP status to send.
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

// ─── Normalisation ───────────────────────────────────────────────────────────
function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hex(s: unknown, fallback: string): string {
  const m = typeof s === "string" ? s.trim().match(/^#?([0-9a-f]{6})$/i) : null;
  return m ? `#${m[1].toLowerCase()}` : fallback;
}

function words(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
}

function str(v: unknown, max = 600): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function normalise(raw: Record<string, unknown>): Conception {
  const name = str(raw.name, 60);
  const brand = str(raw.inspiration_brand, 60);
  const frag = str(raw.inspiration_fragrance, 80);
  const gender = raw.gender === "masculine" || raw.gender === "feminine" ? raw.gender : "unisex";
  const family = FAMILIES.includes(raw.family as (typeof FAMILIES)[number]) ? (raw.family as string) : "Woody";
  return {
    name,
    alternates: words(raw.alternates, 3),
    slug: slugify(name),
    profile: words(raw.profile, 3),
    family,
    gender,
    inspiration: brand && frag ? `Inspired by ${brand} - ${frag}` : brand || frag ? `Inspired by ${brand || frag}` : "",
    tagline: str(raw.tagline, 120),
    story: str(raw.story, 400),
    copy: str(raw.copy, 1200),
    top: words(raw.top, 4),
    heart: words(raw.heart, 4),
    base: words(raw.base, 4),
    liquid: hex(raw.liquid, "#3b2a18"),
    accent: hex(raw.accent, "#c9a961"),
    experience: words(raw.experience, 5),
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: "AI conception is not configured (ANTHROPIC_API_KEY missing)" });
    return;
  }

  const gate = await adminGate(req);
  if (gate) {
    res.status(gate).json({ error: gate === 401 ? "Sign in required" : "Admins only" });
    return;
  }

  const retry = retryAfterSeconds(clientIp(req));
  if (retry > 0) {
    res.setHeader("Retry-After", String(retry));
    res.status(429).json({ error: "rate_limited", retryAfter: retry });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const reference = str(body.reference, 160);
  if (!reference) {
    res.status(400).json({ error: "Missing reference fragrance" });
    return;
  }
  const existing = words(body.existingNames, 300);
  const brief = str(body.brief, 400);

  const user =
    `Reference fragrance: ${reference}\n` +
    (brief ? `Atelier brief: ${brief}\n` : "") +
    (existing.length ? `Names already in the house catalogue (do not reuse): ${existing.join("; ")}\n` : "") +
    "Produce the conception as JSON.";

  const client = new Anthropic({ apiKey });
  res.setHeader("Cache-Control", "no-store");

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      // Structured outputs: the reply is guaranteed to match SCHEMA.
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      // Server-side refusal fallback keeps the console working if the primary
      // model declines a request; the fallback bills at its own rate.
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });

    if (response.stop_reason === "refusal") {
      res.status(422).json({ error: "The model declined to conceive this reference" });
      return;
    }
    if (response.stop_reason === "max_tokens") {
      res.status(502).json({ error: "The conception was cut short — please try again" });
      return;
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const conception = normalise(parsed);
    if (!conception.name) {
      res.status(502).json({ error: "The model returned an empty conception" });
      return;
    }
    res.status(200).json({ conception, model: response.model });
  } catch (err) {
    console.error("conceive error:", err);
    if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "rate_limited", retryAfter: 20 });
    } else if (err instanceof Anthropic.AuthenticationError) {
      res.status(501).json({ error: "AI conception is misconfigured (invalid API key)" });
    } else if (err instanceof Anthropic.APIError) {
      res.status(502).json({ error: `Claude error ${err.status ?? ""}`.trim() });
    } else {
      res.status(500).json({ error: "Conception failed" });
    }
  }
}
