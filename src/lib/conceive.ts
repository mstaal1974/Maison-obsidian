// AI fragrance conception + bottle imagery for the admin console.
//
// `conceiveFragrance()` calls the /api/conceive serverless function (Claude,
// key server-side) and returns a validated Conception the console renders as
// three panels — Brand Conception, Copywriting, Olfactory Breakdown — and can
// turn into a catalogue entry with `conceptionToFragrance()`.
//
// `uploadFragranceImage()` stores the admin's transparent PNG in the
// `fragrance-images` Supabase bucket (public URL) or, in the offline demo,
// inlines it as a data URL so the tile and product page still show it.

import { type Fragrance, type Gender } from "./data";
import { supabase } from "./supabase";

export interface Conception {
  name: string;
  alternates: string[];
  slug: string;
  profile: string[];
  family: string;
  gender: Gender;
  inspiration: string;
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

export type ConceiveErrorKind = "unconfigured" | "unauthorized" | "rate_limited" | "declined" | "failed";

export class ConceiveError extends Error {
  readonly kind: ConceiveErrorKind;
  constructor(message: string, kind: ConceiveErrorKind) {
    super(message);
    this.kind = kind;
  }
}

/** Session access token, so the server can check is_admin(). Null in the demo. */
async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function conceiveFragrance(
  reference: string,
  existingNames: string[],
  brief?: string,
  signal?: AbortSignal,
): Promise<Conception> {
  const token = await accessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch("/api/conceive", {
      method: "POST",
      headers,
      body: JSON.stringify({ reference, existingNames, brief }),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ConceiveError("Could not reach the conception service.", "failed");
  }

  const contentType = res.headers.get("content-type") ?? "";
  // A dev/preview server with no serverless function serves index.html.
  if (contentType.includes("text/html") || res.status === 404) {
    throw new ConceiveError(
      "AI conception runs in the /api/conceive serverless function — deploy to Vercel (or run `vercel dev`) with ANTHROPIC_API_KEY set.",
      "unconfigured",
    );
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; conception?: Conception };
  if (res.ok && body.conception) return body.conception;

  switch (res.status) {
    case 501:
      throw new ConceiveError(body.error ?? "AI conception is not configured on the server.", "unconfigured");
    case 401:
    case 403:
      throw new ConceiveError("Only signed-in admins can conceive fragrances.", "unauthorized");
    case 429:
      throw new ConceiveError("Too many conceptions in a row — give it a minute.", "rate_limited");
    case 422:
      throw new ConceiveError(body.error ?? "The model declined this reference.", "declined");
    default:
      throw new ConceiveError(body.error ?? `Conception failed (${res.status}).`, "failed");
  }
}

/** Median of the catalogue's per-size prices — sensible defaults for a new scent. */
function median(xs: number[], fallback: number): number {
  const s = xs.filter((x) => x > 0).sort((a, b) => a - b);
  if (!s.length) return fallback;
  return s[Math.floor(s.length / 2)];
}

/** Builds a catalogue draft from a conception, priced like the existing range. */
export function conceptionToFragrance(c: Conception, catalogue: Fragrance[], imageUrl?: string): Fragrance {
  // Story on the card and product page: the packaging copy (falls back to the
  // one-liner when the model returned none).
  const story = c.copy.trim() || c.story.trim();
  return {
    id: "",
    slug: uniqueSlug(c.slug || slugify(c.name), catalogue),
    name: c.name,
    inspiration: c.inspiration,
    tagline: c.tagline,
    story,
    price: median(catalogue.map((f) => f.price), 4700),
    price10: median(catalogue.map((f) => f.price10), 2100),
    price30: median(catalogue.map((f) => f.price30), 3400),
    gender: c.gender,
    moq: 20,
    committed: 0,
    liquid: c.liquid,
    accent: c.accent,
    vipOnly: false,
    top: c.top,
    heart: c.heart,
    base: c.base,
    profile: c.profile,
    imageUrl,
    stock10: 0,
    stock30: 0,
    stock50: 0,
    lowStock: 5,
    oilMl: 0,
  };
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSlug(base: string, catalogue: Fragrance[]): string {
  const taken = new Set(catalogue.map((f) => f.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now().toString(36)}`;
}

// ─── Transparent PNG handling ────────────────────────────────────────────────

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export interface PngInfo {
  ok: boolean;
  reason?: string;
  width?: number;
  height?: number;
  /** Colour type carries an alpha channel (RGBA / grey+alpha) or a tRNS chunk. */
  transparent?: boolean;
}

/**
 * Validates a PNG by its header: signature, IHDR dimensions and whether the
 * colour type carries transparency. Palette PNGs count as transparent when a
 * tRNS chunk is present.
 */
export async function inspectPng(file: File): Promise<PngInfo> {
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "PNG must be 4 MB or smaller." };
  const buf = new Uint8Array(await file.slice(0, Math.min(file.size, 64 * 1024)).arrayBuffer());
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 33 || !sig.every((b, i) => buf[i] === b)) return { ok: false, reason: "That file isn't a PNG." };
  const dv = new DataView(buf.buffer);
  const width = dv.getUint32(16);
  const height = dv.getUint32(20);
  const colourType = buf[25];
  let transparent = colourType === 4 || colourType === 6;
  if (!transparent && colourType === 3) {
    // Walk chunks looking for tRNS (before IDAT).
    let off = 8;
    while (off + 8 <= buf.length) {
      const len = dv.getUint32(off);
      const type = String.fromCharCode(buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]);
      if (type === "tRNS") {
        transparent = true;
        break;
      }
      if (type === "IDAT") break;
      off += 12 + len;
    }
  }
  return { ok: true, width, height, transparent };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });
}

/**
 * Uploads the bottle PNG and returns a URL to store on the fragrance. In the
 * configured app this is the public URL of the object in `fragrance-images`;
 * in the demo it's a data URL kept in memory for the session.
 */
export async function uploadFragranceImage(file: File, slug: string): Promise<string> {
  if (!supabase) return readAsDataUrl(file);
  const path = `${slug || "fragrance"}-${Date.now().toString(36)}.png`;
  const { error } = await supabase.storage.from("fragrance-images").upload(path, file, {
    contentType: "image/png",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  const { data } = supabase.storage.from("fragrance-images").getPublicUrl(path);
  return data.publicUrl;
}
