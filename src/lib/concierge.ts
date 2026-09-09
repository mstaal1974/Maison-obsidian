import { type Fragrance, type Filter, matches, money } from "./data";
import { supabase } from "./supabase";
import { formatPrice, formatStatus } from "./formats";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Persists a concierge message via the log_chat_message RPC (user_id is stamped
 * server-side from auth.uid()). No-ops when Supabase isn't configured.
 */
export async function logChat(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  source?: "claude" | "fallback",
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.rpc("log_chat_message", {
      p_conversation_id: conversationId,
      p_role: role,
      p_content: content,
      p_source: source ?? null,
    });
  } catch {
    /* logging is best-effort — never block the chat UI */
  }
}

// ─── Deep-linking recommended scents ─────────────────────────────────────────
export interface TextSegment {
  text: string;
  slug?: string; // present when this segment is a fragrance name → link target
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits assistant text into segments, tagging any exact fragrance-name
 * occurrence with its slug so the UI can render it as a product link. Longest
 * names first so overlapping names match greedily.
 */
export function linkifyFragrances(text: string, frags: Fragrance[]): TextSegment[] {
  if (!frags.length) return [{ text }];
  const byLen = [...frags].sort((a, b) => b.name.length - a.name.length);
  const re = new RegExp(`(${byLen.map((f) => escapeRegExp(f.name)).join("|")})`, "g");
  return text
    .split(re)
    .filter((part) => part !== "")
    .map((part) => {
      const hit = byLen.find((f) => f.name === part);
      return hit ? { text: part, slug: hit.slug } : { text: part };
    });
}

/** Compact catalogue context sent to the server-side concierge. */
export function catalogueSummary(frags: Fragrance[]): string {
  return frags
    .map(
      (f) =>
        `- ${f.name} (${f.inspiration}; ${f.gender}${f.vipOnly ? "; VIP-only" : ""}): ${f.tagline} ` +
        `Notes — top ${f.top.join("/")}, heart ${f.heart.join("/")}, base ${f.base.join("/")}. ` +
        `10ml ${money(f.price10)} · 30ml ${money(f.price30)} · 50ml ${money(f.price)} · car diffuser ${money(formatPrice(f, "car"))}` +
        (formatStatus(f, "wash") === "live" ? ` · body wash ${money(formatPrice(f, "wash"))} · moisturiser ${money(formatPrice(f, "moist"))}.` : " · body care coming soon."),
    )
    .join("\n");
}

/**
 * Streams a concierge reply from the /api/chat serverless function, invoking
 * onDelta with each text chunk. Throws if the endpoint is unavailable (e.g. the
 * offline demo, where the caller should fall back to localFallbackReply).
 */
export async function streamChat(
  messages: ChatMessage[],
  catalogue: string,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
  /** The customer's taste summary — only when they opted in to personalisation. */
  profile?: string,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, catalogue, ...(profile ? { profile } : {}) }),
    signal,
  });
  if (res.status === 429) throw new Error("rate_limited");
  const contentType = res.headers.get("content-type") ?? "";
  // A dev/preview server with no serverless function serves index.html (200) —
  // treat any non-streamable / HTML response as "unavailable" and fall back.
  if (!res.ok || !res.body || contentType.includes("text/html")) {
    throw new Error(`concierge unavailable (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) onDelta(decoder.decode(value, { stream: true }));
  }
}

// ─── Offline fallback ────────────────────────────────────────────────────────
// A small rule-based concierge so the widget is useful without the API key.

function pick(frags: Fragrance[], filter: Filter, note?: string): Fragrance[] {
  let list = frags.filter((f) => matches(f, filter));
  if (note) {
    const n = note.toLowerCase();
    const byNote = list.filter((f) =>
      [...f.top, ...f.heart, ...f.base, f.tagline, f.inspiration].join(" ").toLowerCase().includes(n),
    );
    if (byNote.length) list = byNote;
  }
  return list.slice(0, 4);
}

function names(frags: Fragrance[]): string {
  return frags.map((f) => `${f.name} (${f.tagline})`).join("; ");
}

export function localFallbackReply(text: string, frags: Fragrance[]): string {
  const t = text.toLowerCase().trim();
  const has = (...w: string[]) => w.some((x) => t.includes(x));

  if (!t || has("hello", "hi ", "hey", "help")) {
    return "Welcome to Maison Obsidian. I can explain how our batch commits work, recommend a scent by note or occasion, or walk you through sizes, engraving, VIP, and shipping. What are you after?";
  }
  if (has("commit", "batch", "authoriz", "charge", "moq", "pour", "reserve")) {
    return "Each fragrance is poured in a small batch. When you commit, your card is authorized — never charged — until the batch reaches its minimum. Only then do we capture payment and pour; if a batch closes short, the hold is released, no questions asked.";
  }
  if (has("ship", "delivery", "deliver", "post", "track")) {
    return "Bottles ship via Australia Post Parcel Post once a batch pours and payment is captured. You'll see status and a tracking link under “My Reservations” in your account.";
  }
  if (has("size", "ml", "price", "cost", "how much")) {
    return "Every scent comes in three sizes — 10 ml, 30 ml, and 50 ml — at 30% extrait. Prices vary by fragrance; open any product to see the three tiers and pick your size before committing.";
  }
  if (has("engrav", "custom", "name on")) {
    return "You can engrave up to 28 characters on the bottle label — a name, a date, a secret. Toggle Custom Engraving on the product page and it previews live as you type. It's complimentary for VIP members.";
  }
  if (has("vip", "member", "club", "subscri")) {
    return "The VIP Club is $120/year: early access to locked batches, first claim on re-pours, and complimentary engraving on every order. Some scents are VIP-only — join from the VIP Club section once you're signed in.";
  }
  if (has("account", "sign in", "log in", "login", "reservation", "order")) {
    return "Sign in (email or Google) to commit to a batch, join VIP, and track everything under “My Reservations,” where each commit shows its size, engraving, batch progress, and shipping status.";
  }

  const gender: Filter = has("him", "men", "masculine", "male") ? "men" : has("her", "women", "feminine", "female") ? "women" : "all";
  if (has("recommend", "suggest", "which", "looking for", "like", "similar", "note", "for him", "for her", "gift") || gender !== "all") {
    const noteMatch = ["oud", "rose", "vanilla", "citrus", "tobacco", "leather", "amber", "saffron", "jasmine", "smoke", "spice", "musk", "wood"].find((n) => t.includes(n));
    const picks = pick(frags, gender, noteMatch);
    if (picks.length) {
      return `A few you might love: ${names(picks)}. Open any in the Vault to read its full composition and commit.`;
    }
  }
  if (has("list", "what do you have", "catalog", "catalogue", "scents", "fragrances", "range")) {
    return `We're currently pouring ${frags.length} scents — for example: ${names(frags.slice(0, 4))}. Browse them all in the Vault.`;
  }

  return "I can help with our batch-commit model, sizes and pricing, engraving, VIP membership, shipping, or a recommendation by note or occasion. Could you tell me a little more about what you're looking for?";
}
