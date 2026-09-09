// ─── Admin: the marketing audience and each member's taste profile ───────────
//
// Who has said yes to marketing email (and, separately, to AI
// personalisation), joined to what they bought, subscribed to, requested and
// asked the concierge — so the console can segment, export, and draft notes.
// Only members with marketing consent are listed; the concierge/surprise use
// of a profile is gated separately on the AI consent.

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAllCommits } from "./admin";
import { bagOrders } from "./bag";
import type { Fragrance } from "./data";
import { buildTasteProfile, demoConsents, demoSignups, type TasteProfile } from "./profile";
import { demoRequestQueries } from "./requests";
import type { Subscription } from "./subscription";
import { supabase } from "./supabase";

export interface AudienceMember {
  email: string;
  userId: string | null;
  marketing: boolean;
  ai: boolean;
  source: string | null;
  optedInAt: string | null;
  profile: TasteProfile;
  purchases: number;
  subscription: Subscription | null;
}

interface AudienceRow {
  email: string;
  user_id: string | null;
  marketing_opt_in: boolean;
  ai_opt_in: boolean;
  source: string | null;
  opted_in_at: string | null;
}
interface RequestRow {
  query: string;
  email: string | null;
  user_id: string | null;
}
interface ChatRow {
  user_id: string | null;
  content: string;
}

interface Raw {
  rows: AudienceRow[];
  commits: { user_id?: string | null; user_email?: string | null; fragrance_id: string; format?: string | null }[];
  requests: RequestRow[];
  chats: ChatRow[];
}

export function useAudience(fragrances: Fragrance[], subscriptions: Subscription[]) {
  const [raw, setRaw] = useState<Raw | null>(null);

  const reload = useCallback(() => {
    if (!supabase) return;
    void (async () => {
      const [a, c, r, m] = await Promise.all([
        supabase.from("marketing_audience").select("email, user_id, marketing_opt_in, ai_opt_in, source, opted_in_at").order("opted_in_at", { ascending: false }),
        fetchAllCommits(),
        supabase.from("scent_requests").select("query, email, user_id"),
        supabase.from("chat_messages").select("user_id, content").eq("role", "user").order("created_at", { ascending: false }).limit(2000),
      ]);
      setRaw({
        rows: (a.data ?? []) as AudienceRow[],
        commits: c ?? [],
        requests: (r.data ?? []) as RequestRow[],
        chats: (m.data ?? []) as ChatRow[],
      });
    })();
  }, []);

  useEffect(() => reload(), [reload]);

  const members = useMemo<AudienceMember[]>(() => {
    if (!supabase) {
      // Demo: everything this browser did belongs to whoever signed up here.
      const consents = demoConsents();
      const orders = bagOrders();
      const requests = demoRequestQueries();
      return demoSignups().map((s, i) => {
        const mine = i === 0; // the most recent signup is the demo account holder
        const sub = mine ? (subscriptions.find((x) => x.status === "active") ?? subscriptions[0] ?? null) : null;
        const purchases = mine ? orders.flatMap((o) => Array.from({ length: o.qty }, () => ({ fragranceId: o.fragranceId, format: o.format }))) : [];
        return {
          email: s.email,
          userId: null,
          marketing: s.optedIn,
          ai: mine && consents.ai,
          source: s.source,
          optedInAt: s.createdAt,
          profile: buildTasteProfile(fragrances, { purchases, subscriptions: sub ? [sub] : [], requests: mine ? requests : [], chats: [] }),
          purchases: purchases.length,
          subscription: sub,
        };
      });
    }
    if (!raw) return [];
    return raw.rows.map((row) => {
      const email = row.email.toLowerCase();
      const isMine = (uid?: string | null, mail?: string | null) => (!!row.user_id && uid === row.user_id) || (mail ?? "").toLowerCase() === email;
      const purchases = raw.commits.filter((c) => isMine(c.user_id, c.user_email)).map((c) => ({ fragranceId: c.fragrance_id, format: c.format ?? null }));
      const subs = subscriptions.filter((s) => isMine(s.userId, s.userEmail));
      const requests = raw.requests.filter((r) => isMine(r.user_id, r.email)).map((r) => r.query);
      const chats = row.user_id ? raw.chats.filter((c) => c.user_id === row.user_id).map((c) => c.content) : [];
      return {
        email,
        userId: row.user_id,
        marketing: row.marketing_opt_in,
        ai: row.ai_opt_in,
        source: row.source,
        optedInAt: row.opted_in_at,
        profile: buildTasteProfile(fragrances, { purchases, subscriptions: subs, requests, chats }),
        purchases: purchases.length,
        subscription: subs.find((s) => s.status === "active") ?? subs[0] ?? null,
      };
    });
  }, [raw, fragrances, subscriptions]);

  return { members, loading: !!supabase && raw === null, reload };
}

/** Rows → CSV text (RFC 4180 quoting). */
export function audienceCsv(members: AudienceMember[]): string {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["email", "marketing_opt_in", "ai_opt_in", "source", "opted_in_at", "leans", "favourites", "formats", "purchases", "subscription"];
  const lines = members.map((m) =>
    [
      m.email,
      m.marketing,
      m.ai,
      m.source ?? "",
      m.optedInAt ?? "",
      m.profile.moods.map((x) => x.id).join(" "),
      m.profile.favourites.map((f) => f.fragrance.name).join("; "),
      m.profile.formats.map((f) => f.key).join(" "),
      m.purchases,
      m.subscription ? `${m.subscription.format} ${m.subscription.status}` : "",
    ]
      .map(q)
      .join(","),
  );
  return [head.map(q).join(","), ...lines].join("\r\n");
}

export interface Draft {
  subject: string;
  preview: string;
  body: string;
}

/**
 * Asks /api/marketing for a note to a segment. Falls back to a house
 * template when the endpoint isn't available (demo, no API key).
 */
export async function draftNote(segment: string, scents: string, angle: string): Promise<{ draft: Draft; source: "claude" | "template" }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  try {
    const res = await fetch("/api/marketing", { method: "POST", headers, body: JSON.stringify({ segment, scents, angle }) });
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && type.includes("application/json")) {
      const json = (await res.json()) as { draft: Draft };
      if (json.draft?.subject) return { draft: json.draft, source: "claude" };
    }
  } catch {
    /* fall through to the template */
  }
  const first = scents.split(",")[0]?.trim();
  const sentence = (t: string) => (t && !/[.!?]$/.test(t) ? `${t}.` : t);
  return {
    source: "template",
    draft: {
      subject: first ? `${first} is pouring again` : "Something new in the house",
      preview: angle || "A note from the atelier, for the scents you return to.",
      body:
        `A quiet note from the house.\n\n${sentence(angle) || "There's a new batch opening this week, and it sits squarely in the profiles you've been drawn to."}` +
        (first ? ` If ${first} is a favourite, this one belongs beside it.` : "") +
        `\n\nReserve a bottle before the batch fills, or let the Monthly Pour bring one to your door at ten percent under shelf.`,
    },
  };
}
