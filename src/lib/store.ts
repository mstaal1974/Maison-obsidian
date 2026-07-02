import { useEffect, useState } from "react";
import { type Fragrance, FRAGS } from "./data";
import { supabase, type FragranceRow } from "./supabase";

type Source = "seed" | "supabase";

function rowToFragrance(r: FragranceRow): Fragrance {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    inspiration: r.inspiration,
    tagline: r.tagline,
    story: r.story,
    price: r.price_cents,
    gender: r.gender,
    moq: r.moq,
    committed: r.committed,
    liquid: r.liquid,
    accent: r.accent,
    vipOnly: r.vip_only,
    top: r.top ?? [],
    heart: r.heart ?? [],
    base: r.base ?? [],
  };
}

/**
 * Returns the catalogue. Renders the seed data immediately (no loading flash),
 * then swaps in live rows — including up-to-date `committed` counts — once
 * Supabase responds. Falls back to seed on any error or when unconfigured.
 */
export function useFragrances() {
  const [fragrances, setFragrances] = useState<Fragrance[]>(FRAGS);
  const [source, setSource] = useState<Source>("seed");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase
      .from("fragrances")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (!active || error || !data || data.length === 0) return;
        setFragrances((data as FragranceRow[]).map(rowToFragrance));
        setSource("supabase");
      });
    return () => {
      active = false;
    };
  }, []);

  return { fragrances, source };
}

/**
 * Records a batch commit in Supabase via the atomic `commit_to_batch` RPC.
 * No-ops when Supabase isn't configured (the UI already tracks commits
 * locally and persists them to localStorage). Errors are swallowed so a
 * backend hiccup never blocks the optimistic UI.
 */
export async function recordCommit(
  fragranceId: string,
  engraving: string | null,
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.rpc("commit_to_batch", {
      p_fragrance_id: fragranceId,
      p_engraving: engraving,
    });
  } catch {
    /* offline / RLS / network — optimistic UI already reflects the commit */
  }
}
