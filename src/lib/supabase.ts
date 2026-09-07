import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabase is optional: if the env vars aren't set (e.g. the offline demo),
// `supabase` is null and the app falls back to the seed catalogue.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = supabase !== null;

// Shape of a row in public.fragrances (snake_case, as stored).
export interface FragranceRow {
  id: string;
  slug: string;
  name: string;
  inspiration: string;
  tagline: string;
  story: string;
  price_10ml_cents: number;
  price_30ml_cents: number;
  price_50ml_cents: number;
  gender: "masculine" | "feminine" | "unisex";
  moq: number;
  committed: number;
  liquid: string;
  accent: string;
  vip_only: boolean;
  top: string[];
  heart: string[];
  base: string[];
  sort_order: number;
  stock_10ml?: number;
  stock_30ml?: number;
  stock_50ml?: number;
  low_stock_threshold?: number;
  oil_ml?: number;
  image_url?: string | null;
  profile?: string[];
  format_prices?: Record<string, number> | null;
  format_status?: Record<string, string> | null;
  stock_car?: number;
  stock_wash?: number;
  stock_moist?: number;
}
