// Product reviews from verified buyers (supabase/migrations/0033_reviews.sql).
// Anyone can read published reviews; a signed-in customer who has bought a
// fragrance can write one, which waits for an admin to publish it. Without
// Supabase (the offline demo) there are no reviews and no form.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export type ReviewStatus = "pending" | "published" | "rejected";

export interface Review {
  id: string;
  fragranceId: string;
  rating: number;
  title: string | null;
  body: string;
  displayName: string;
  status: ReviewStatus;
  createdAt: string;
}

interface ReviewRow {
  id: string;
  fragrance_id: string;
  rating: number;
  title: string | null;
  body: string;
  display_name: string;
  status: ReviewStatus;
  created_at: string;
}

// user_id is deliberately absent: the API doesn't expose it.
const COLUMNS = "id, fragrance_id, rating, title, body, display_name, status, created_at";

const toReview = (r: ReviewRow): Review => ({
  id: r.id,
  fragranceId: r.fragrance_id,
  rating: r.rating,
  title: r.title,
  body: r.body,
  displayName: r.display_name,
  status: r.status,
  createdAt: r.created_at,
});

export interface RatingSummary {
  average: number;
  count: number;
}

export function summarise(reviews: Review[]): RatingSummary | null {
  const shown = reviews.filter((r) => r.status === "published");
  if (!shown.length) return null;
  return { average: shown.reduce((s, r) => s + r.rating, 0) / shown.length, count: shown.length };
}

/** Published reviews for one fragrance, newest first. */
export function useReviews(fragranceId: string) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(!!supabase);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    void supabase
      .from("reviews")
      .select(COLUMNS)
      .eq("fragrance_id", fragranceId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!live) return;
        setReviews(((data ?? []) as ReviewRow[]).map(toReview));
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [fragranceId, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { reviews, loading, reload, enabled: !!supabase };
}

/** Whether the signed-in customer has bought this fragrance and may review it. */
export function useCanReview(fragranceId: string, userId: string | null) {
  const [can, setCan] = useState(false);
  useEffect(() => {
    if (!supabase || !userId) return;
    let live = true;
    void supabase.rpc("can_review", { p_fragrance_id: fragranceId }).then(({ data }) => {
      if (live) setCan(data === true);
    });
    return () => {
      live = false;
    };
  }, [fragranceId, userId]);
  return !!userId && can;
}

export async function submitReview(input: { fragranceId: string; rating: number; title: string; body: string; displayName: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "Reviews aren't available right now." };
  const { error } = await supabase.rpc("submit_review", {
    p_fragrance_id: input.fragranceId,
    p_rating: input.rating,
    p_body: input.body,
    p_display_name: input.displayName,
    p_title: input.title || null,
  });
  if (!error) return { ok: true };
  if (/bought this fragrance/i.test(error.message)) return { ok: false, error: "Reviews are open to customers who have bought this fragrance." };
  if (/check constraint|violates/i.test(error.message)) return { ok: false, error: "Please give a rating, a name, and at least a sentence about the scent." };
  return { ok: false, error: "Your review couldn't be sent. Please try again." };
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export function useAdminReviews(status: ReviewStatus | "all") {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(!!supabase);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    let q = supabase.from("reviews").select(COLUMNS).order("created_at", { ascending: false }).limit(200);
    if (status !== "all") q = q.eq("status", status);
    void q.then(({ data }) => {
      if (!live) return;
      setReviews(((data ?? []) as ReviewRow[]).map(toReview));
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [status, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { reviews, loading, reload };
}

export async function setReviewStatus(id: string, status: ReviewStatus): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("admin_set_review_status", { p_id: id, p_status: status });
  return !error;
}
