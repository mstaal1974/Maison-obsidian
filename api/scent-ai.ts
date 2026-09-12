// Vercel serverless function — the Scent DNA AI layer.
//
// Six capabilities behind one route. They share a prompt prefix (house voice +
// the Scentprint vocabulary + the live catalogue), so a single cache breakpoint
// covers all of them and a customer moving from the conversation to their
// matches to a curated set isn't paying to re-read the catalogue each time.
//
// One route rather than six because Vercel's function budget is nearly spent
// (eleven of twelve) — `op` discriminates.
//
// Ground rule that runs through every operation: the deterministic engine in
// src/lib/scentdna.ts computes the Scentprint and the compatibility scores. The
// model never scores anything. It reads numbers we hand it and puts them into
// language, or it proposes adjustments the client applies through that same
// engine. That is what keeps a "94% match" true rather than plausible.
//
// ANTHROPIC_API_KEY lives in the Vercel project settings and never reaches the
// browser. Without it every operation returns 501 and the client falls back to
// its own local reasoning, so the experience still works.

import Anthropic from "@anthropic-ai/sdk";

export const config = { runtime: "nodejs" };

// Mirrors SCENT_DIMS in src/lib/scentdna.ts. The api folder runs as plain ES
// modules on Vercel and cannot import the storefront's code, so these sixteen
// keys are duplicated here on purpose; the client clamps whatever comes back
// through scentprintFrom(), so a drift can't corrupt a profile.
const DIMS = [
  "fresh", "citrus", "aquatic", "aromatic", "green", "floral", "fruity", "sweet",
  "gourmand", "spicy", "woody", "amber", "musk", "smoky", "powdery", "clean",
] as const;

const BEHAVIOURS = [
  "projection", "longevity", "sweetness", "intensity",
  "familiarity", "adventurousness", "night", "formality",
] as const;

const HOUSE = `You are the scent intelligence behind Maison Obsidian, a boutique atelier fragrance house.

Voice: warm, precise, quietly luxurious. Never breathless, never salesy. Short sentences. You are talking to someone who may know nothing about perfume and should never be made to feel that.

THE SCENTPRINT
A Scentprint is sixteen scent dimensions scored 0-100 — ${DIMS.join(", ")} — plus eight behavioural attributes: ${BEHAVIOURS.join(", ")}. On the behavioural axes, "night" runs day (0) to night (100), "formality" runs casual (0) to formal (100), and "familiarity" is the inverse of "adventurousness".

RULES YOU DO NOT BREAK
1. You never compute or assert a compatibility score. Scores are given to you. Repeat them exactly or not at all.
2. You never name a fragrance that is not in the catalogue below, and you spell catalogue names exactly.
3. You never invent notes, prices, or a scent's character. Everything you say about a fragrance comes from its catalogue entry.
4. You avoid perfumery jargon with customers. Say "warm and sweet like toffee", not "gourmand accord". Words like sillage, chypre, fougère, accord and drydown are banned in anything a customer reads.
5. When you are uncertain, say so plainly rather than inventing confidence.`;

// ─── Per-IP rate limit (same shape as the other AI routes) ───────────────────
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 24;
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

// ─── Input hygiene ───────────────────────────────────────────────────────────
function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function dimsObject(required: readonly string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: [...required],
    properties: Object.fromEntries(required.map((d) => [d, { type: "integer", minimum: 0, maximum: 100 }])),
  };
}

// ─── Schemas, one per operation ──────────────────────────────────────────────
const SCHEMAS: Record<string, Record<string, unknown>> = {
  converse: {
    type: "object",
    additionalProperties: false,
    required: ["reply", "ready", "confidence", "dims"],
    properties: {
      reply: { type: "string", description: "What to say next: a reaction plus one question. Two sentences at most." },
      ready: { type: "boolean", description: "True only when you could describe this person's taste to a perfumer." },
      confidence: { type: "integer", minimum: 0, maximum: 100, description: "How well you know them so far." },
      dims: dimsObject(DIMS),
      behaviour: dimsObject(BEHAVIOURS),
      reading: { type: "string", description: "One short line naming what you have learned so far, in plain words." },
    },
  },
  imagine: {
    type: "object",
    additionalProperties: false,
    required: ["dims", "behaviour", "title", "story"],
    properties: {
      dims: dimsObject(DIMS),
      behaviour: dimsObject(BEHAVIOURS),
      title: { type: "string", description: "Three or four words naming this scent world, e.g. 'Salt Air and Cedar'." },
      story: { type: "string", description: "Two sentences on what this would smell like. Plain language, no jargon." },
      cues: { type: "array", maxItems: 6, items: { type: "string" }, description: "The concrete things you read: 'wet pine', 'low sun'." },
    },
  },
  explain: {
    type: "object",
    additionalProperties: false,
    required: ["explanations"],
    properties: {
      explanations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slug", "headline", "body"],
          properties: {
            slug: { type: "string" },
            headline: { type: "string", description: "Six words or fewer on why this one." },
            body: { type: "string", description: "Two sentences. Name the dimensions they share, using the numbers given." },
            caution: { type: "string", description: "Optional: the one way it might not suit them. Omit if there isn't one." },
          },
        },
      },
    },
  },
  curate: {
    type: "object",
    additionalProperties: false,
    required: ["slugs", "setName", "rationale", "roles"],
    properties: {
      slugs: { type: "array", minItems: 1, items: { type: "string" }, description: "The chosen scents, in the order they should be worn." },
      setName: { type: "string", description: "Three or four words naming the set." },
      rationale: { type: "string", description: "Two sentences on why these five together — as a set, not five picks." },
      roles: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slug", "role", "when"],
          properties: {
            slug: { type: "string" },
            role: { type: "string", description: "What this one is for in the set: 'the safe one', 'the stretch'." },
            when: { type: "string", description: "When to wear it. A few words." },
          },
        },
      },
    },
  },
  explore: {
    type: "object",
    additionalProperties: false,
    required: ["picks"],
    properties: {
      picks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slug", "stretch", "reason"],
          properties: {
            slug: { type: "string" },
            stretch: { type: "string", enum: ["home", "step", "leap"], description: "How far from their Scentprint this sits." },
            reason: { type: "string", description: "One sentence: what it keeps of theirs, and what it changes." },
          },
        },
      },
    },
  },
  interpret: {
    type: "object",
    additionalProperties: false,
    required: ["adjustments", "summary"],
    properties: {
      adjustments: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["dim", "delta"],
          properties: {
            dim: { type: "string", enum: [...DIMS, ...BEHAVIOURS] },
            delta: { type: "integer", minimum: -40, maximum: 40, description: "How far to move it, in Scentprint points." },
          },
        },
      },
      summary: { type: "string", description: "One line on what this tells us about them." },
      confidence: { type: "integer", minimum: 0, maximum: 100 },
    },
  },
};

const EFFORT: Record<string, "low" | "medium" | "high"> = {
  converse: "medium",
  imagine: "medium",
  explain: "low",
  curate: "medium",
  explore: "medium",
  interpret: "low",
};

type ImageMedia = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

/** Only the four types the API accepts, matched exactly rather than asserted. */
function imageMediaType(value: unknown): ImageMedia | null {
  const media = str(value, 40).toLowerCase();
  switch (media) {
    case "image/png":
    case "image/jpeg":
    case "image/webp":
    case "image/gif":
      return media;
    case "image/jpg":
      return "image/jpeg";
    default:
      return null;
  }
}

/** The instruction that turns the shared prefix into one operation. */
function instruction(op: string, body: any): string {
  switch (op) {
    case "converse":
      return [
        "You are having a short conversation to learn what someone likes to smell like. They may know nothing about fragrance.",
        "Ask about places, weather, materials, food, times of day, what they wear — never about notes or families.",
        "One question at a time. React to what they said before asking the next thing, warmly and briefly.",
        "Fill in the whole Scentprint every turn with your best current estimate; it is shown to them filling in as you talk, so move it honestly rather than guessing wildly early.",
        "Set ready to true once four or five substantial answers let you describe their taste to a perfumer — usually five or six exchanges. Do not drag it out.",
      ].join(" ");
    case "imagine":
      return [
        "Read what you are given — a photograph, a memory, or both — and translate it into a Scentprint.",
        "Work from the concrete: light, weather, materials, surfaces, season, time of day, what the air would carry.",
        "Do not describe the picture back. Describe what it would smell like to stand in it.",
        "The title and story are shown on a shareable card, so make them specific to this, not generic.",
      ].join(" ");
    case "explain":
      return [
        "For each fragrance below, say why it suits this person.",
        "You are given their Scentprint, the fragrance's own, the computed compatibility, and the dimensions they share. Use those numbers; never state a different one.",
        "Name what the two actually have in common, in plain words. If the fragrance pushes somewhere they didn't ask for, say so in caution rather than hiding it.",
        "Return one explanation per fragrance, in the order given.",
      ].join(" ");
    case "curate": {
      const size = Number(body?.size) || 5;
      return [
        `Choose exactly ${size} fragrances from the candidates for a discovery set.`,
        "A set is not the top five scores. It should cover the ground this person actually lives in — an everyday one, one for work or the evening if they named those, and one deliberate stretch that is still recognisably theirs.",
        "Avoid two scents that would smell like each other; the whole point is to learn something from wearing them.",
        "Choose only from the candidate slugs given.",
      ].join(" ");
    }
    case "explore": {
      const level = Math.max(0, Math.min(100, Number(body?.adventurousness) || 50));
      return [
        `Rank the candidates for someone whose appetite for the unfamiliar is ${level} out of 100.`,
        level < 35
          ? "They want to feel at home. Lead with what sits closest to their Scentprint; one gentle step is enough."
          : level > 65
            ? "They want to be taken somewhere. Lead with real departures, but each must keep something of theirs — a leap is not a random scent."
            : "Balance the two: a couple that feel like them, a couple that move somewhere new.",
        "Label each home, step or leap, and say in one sentence what it keeps and what it changes.",
        "Choose only from the candidate slugs given, and return at most ten.",
      ].join(" ");
    }
    case "interpret":
      return [
        "Someone has said something about a fragrance they tried. Turn it into adjustments to their Scentprint.",
        "Only move dimensions the words actually support. 'Too sweet' moves sweetness down; it says nothing about wood.",
        "Deltas are small corrections, not rewrites: ±5 for a hint, ±15 for a clear statement, ±30 only for something emphatic.",
        "Return no adjustments at all if the words carry no scent information.",
      ].join(" ");
    default:
      return "";
  }
}

/** The per-operation payload, after the cached prefix. */
function userContent(op: string, body: any): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];

  if (op === "imagine" && body?.image?.data) {
    const media = imageMediaType(body.image.mediaType);
    if (media) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: media, data: String(body.image.data).slice(0, 7_000_000) },
      });
    }
  }

  const parts: string[] = [instruction(op, body)];
  const print = body?.print ? JSON.stringify(body.print).slice(0, 4000) : "";
  const candidates = str(typeof body?.candidates === "string" ? body.candidates : "", 12_000);

  if (print) parts.push(`\nTheir Scentprint:\n${print}`);
  if (candidates) parts.push(`\nCandidates:\n${candidates}`);

  if (op === "converse") {
    const history = Array.isArray(body?.messages)
      ? body.messages
          .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-14)
          .map((m: any) => `${m.role === "user" ? "Them" : "You"}: ${String(m.content).slice(0, 1500)}`)
          .join("\n")
      : "";
    parts.push(history ? `\nThe conversation so far:\n${history}` : "\nThis is the opening turn — greet them and ask the first question.");
  }
  if (op === "imagine") {
    const memory = str(body?.memory, 2000);
    parts.push(memory ? `\nWhat they described:\n${memory}` : "\nThey gave only the image.");
  }
  if (op === "interpret") {
    parts.push(`\nWhat they said:\n${str(body?.feedback, 1000)}`);
    const about = str(body?.about, 300);
    if (about) parts.push(`\nAbout: ${about}`);
  }

  blocks.push({ type: "text", text: parts.join("\n") });
  return blocks;
}

/**
 * The shared prefix, with the breakpoint on its last block. Every operation
 * sends exactly this, so the catalogue is read once per cache window rather
 * than once per call.
 */
function cacheableSystem(catalogue: string): Anthropic.Beta.BetaTextBlockParam[] {
  const cache = { type: "ephemeral" as const };
  return catalogue
    ? [
        { type: "text", text: HOUSE },
        { type: "text", text: `\nThe house catalogue:\n${catalogue}`, cache_control: cache },
      ]
    : [{ type: "text", text: HOUSE, cache_control: cache }];
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  // Either name works: Vercel projects have been set up with both
  // ANTHROPIC_API_KEY and the shorter ANTHROPIC_KEY, and a mismatch here
  // fails silently — the route 501s and the fallback hides it.
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    // The client has a local fallback for every operation; 501 tells it to use it.
    res.status(501).json({ error: "Scent AI is not configured" });
    return;
  }

  const retry = retryAfterSeconds(clientIp(req));
  if (retry > 0) {
    res.setHeader("Retry-After", String(retry));
    res.status(429).json({ error: "rate_limited", retryAfter: retry });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const op = str(body.op, 20);
  const schema = SCHEMAS[op];
  if (!schema) {
    res.status(400).json({ error: `Unknown operation "${op}"` });
    return;
  }

  // The catalogue is built and sent by the client so the storefront's note
  // lexicon stays the single source of truth. It is deterministic, which is
  // what lets it sit inside the cached prefix.
  const catalogue = str(body.catalogue, 24_000);

  const client = new Anthropic({ apiKey });
  res.setHeader("Cache-Control", "no-store");

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: op === "explain" || op === "curate" ? 8192 : 4096,
      output_config: { effort: EFFORT[op] ?? "medium", format: { type: "json_schema", schema } },
      // Everything above the breakpoint is identical for every operation, so a
      // customer moving through the experience reads the catalogue once.
      system: cacheableSystem(catalogue),
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      messages: [{ role: "user", content: userContent(op, body) }],
    });

    if (response.stop_reason === "refusal") {
      res.status(422).json({ error: "declined" });
      return;
    }
    if (response.stop_reason === "max_tokens") {
      res.status(502).json({ error: "The answer was cut short — please try again" });
      return;
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    res.status(200).json({ op, result: JSON.parse(text), model: response.model });
  } catch (err) {
    console.error(`scent-ai ${op} error:`, err);
    if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "rate_limited", retryAfter: 20 });
    } else if (err instanceof Anthropic.AuthenticationError) {
      res.status(501).json({ error: "Scent AI is misconfigured (invalid API key)" });
    } else if (err instanceof Anthropic.APIError) {
      res.status(502).json({ error: `Claude error ${err.status ?? ""}`.trim() });
    } else {
      res.status(500).json({ error: "Scent AI failed" });
    }
  }
}
