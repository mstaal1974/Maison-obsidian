// AI fragrance conception + bottle imagery for the admin console.
//
// `conceiveFragrance()` calls the /api/conceive serverless function (Claude,
// key server-side) and returns a validated Conception the console renders as
// three panels — Brand Conception, Copywriting, Olfactory Breakdown — and can
// turn into a catalogue entry with `conceptionToFragrance()`.
//
// `uploadFragranceImage()` stores the admin's bottle image (PNG/JPG/WebP) in the
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

// ─── Bottle image handling ───────────────────────────────────────────────────

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export type ImageFormat = "png" | "jpeg" | "webp";

/** The formats a bottle image may be uploaded in, as a file-input accept list. */
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

export interface ImageInfo {
  ok: boolean;
  reason?: string;
  format?: ImageFormat;
  width?: number;
  height?: number;
  /**
   * The file can carry transparency (PNG with alpha / tRNS, WebP with an alpha
   * flag). JPEGs never do: they render as full-frame photography instead of a
   * cut-out on the tinted backdrop.
   */
  transparent?: boolean;
}

/** @deprecated Kept for older imports; the validator now takes PNG, JPEG and WebP. */
export type PngInfo = ImageInfo;

const MIME: Record<ImageFormat, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
const EXT: Record<ImageFormat, string> = { png: "png", jpeg: "jpg", webp: "webp" };

/**
 * Validates a bottle image by its header rather than its extension: PNG
 * (signature + IHDR), JPEG (SOI + a SOF frame for the size) or WebP (RIFF
 * container; VP8X/VP8L chunks say whether alpha is present).
 */
export async function inspectImage(file: File): Promise<ImageInfo> {
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "Image must be 4 MB or smaller." };
  const buf = new Uint8Array(await file.slice(0, Math.min(file.size, 64 * 1024)).arrayBuffer());
  const dv = new DataView(buf.buffer);

  // PNG
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length >= 33 && pngSig.every((b, i) => buf[i] === b)) {
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
    return { ok: true, format: "png", width, height, transparent };
  }

  // JPEG
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let width: number | undefined;
    let height: number | undefined;
    let off = 2;
    while (off + 9 <= buf.length) {
      if (buf[off] !== 0xff) break;
      const marker = buf[off + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        off += 2;
        continue;
      }
      const len = dv.getUint16(off + 2);
      // SOF0..SOF15 except DHT (C4), JPG (C8), DAC (CC) carry the frame size.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        height = dv.getUint16(off + 5);
        width = dv.getUint16(off + 7);
        break;
      }
      off += 2 + len;
    }
    return { ok: true, format: "jpeg", width, height, transparent: false };
  }

  // WebP
  const ascii = (o: number, n: number) => String.fromCharCode(...buf.slice(o, o + n));
  if (buf.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    let transparent = false;
    let width: number | undefined;
    let height: number | undefined;
    if (chunk === "VP8X") {
      transparent = (buf[20] & 0x10) !== 0;
      width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    } else if (chunk === "VP8L") {
      const b = dv.getUint32(21, true);
      width = 1 + (b & 0x3fff);
      height = 1 + ((b >> 14) & 0x3fff);
      transparent = ((b >> 28) & 1) === 1;
    } else if (chunk === "VP8 ") {
      width = dv.getUint16(26, true) & 0x3fff;
      height = dv.getUint16(28, true) & 0x3fff;
    }
    return { ok: true, format: "webp", width, height, transparent };
  }

  return { ok: false, reason: "That file isn't a PNG, JPG or WebP image." };
}

/** @deprecated Use inspectImage; kept so older call sites keep compiling. */
export const inspectPng = inspectImage;

/**
 * True for a stored bottle image that has no transparency (a JPEG), so the
 * tiles show it as full-frame photography rather than a cut-out on a
 * gradient. Judged from the URL: uploads carry their real extension and demo
 * data URLs their MIME type.
 */
export function isPhotoImage(url: string | undefined): boolean {
  if (!url) return false;
  return /^data:image\/jpe?g[;,]/i.test(url) || /\.jpe?g(\?|#|$)/i.test(url);
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
 * Uploads the bottle image (PNG, JPEG or WebP) and returns a URL to store on
 * the fragrance. In the configured app this is the public URL of the object in
 * `fragrance-images`; in the demo it's a data URL kept in memory for the
 * session. The object keeps the real extension so the storefront can tell a
 * photo from a cut-out.
 */
export async function uploadFragranceImage(file: File, slug: string): Promise<string> {
  if (!supabase) return readAsDataUrl(file);
  const info = await inspectImage(file);
  if (!info.ok || !info.format) throw new Error(info.reason ?? "Unsupported image.");
  const path = `${slug || "fragrance"}-${Date.now().toString(36)}.${EXT[info.format]}`;
  const { error } = await supabase.storage.from("fragrance-images").upload(path, file, {
    contentType: MIME[info.format],
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  const { data } = supabase.storage.from("fragrance-images").getPublicUrl(path);
  return data.publicUrl;
}
