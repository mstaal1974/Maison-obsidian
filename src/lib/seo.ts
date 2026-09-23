// What a page tells search engines and social cards: title, description,
// canonical URL, Open Graph tags and, for a fragrance, schema.org Product data.
//
// scripts/prerender.mjs uses productMeta() at build time to write a static
// page per fragrance (crawlers and link previews read the HTML without running
// the app); usePageMeta() keeps the tags right as the shopper moves around.

import { useEffect } from "react";
import { type Fragrance } from "./data";
import { referenceLine, referenceOf, skusInGroup } from "./formats";
import { paths } from "./route";

export const SITE_NAME = "Maison Obsidian";

/** The storefront's own tags, as in index.html. */
export const DEFAULT_META: PageMeta = {
  title: "Maison Obsidian — Boutique Laboratory",
  description:
    "Maison Obsidian — a boutique batch laboratory. Fragrance poured in small numbers; your card is authorized, never charged, until the batch is met.",
  image: "/assets/bottle-pair.png",
};

export interface PageMeta {
  title: string;
  description: string;
  /** Site-relative path, e.g. /fragrance/smoky-timber. Without one the page
   *  names no canonical URL and the address bar stands. */
  path?: string;
  /** Site-relative or absolute image URL for the social card. */
  image?: string;
  type?: "website" | "product";
  jsonLd?: Record<string, unknown>;
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function absolute(url: string, origin: string): string {
  return /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * "Smoky Timber — Inspired by Tom Ford Oud Wood | Maison Obsidian": the
 * reference is what people search for, so it follows the name. Search results
 * show about 60 characters, so a long one drops the house name rather than
 * lose the reference.
 */
export function productTitle(f: Fragrance): string {
  const { brand, fragrance } = referenceOf(f);
  const ref = [brand, fragrance].filter(Boolean).join(" ");
  const core = ref ? `${f.name} — Inspired by ${ref}` : f.name;
  const full = `${core} | ${SITE_NAME}`;
  return full.length <= 65 ? full : core;
}

/** Title, description, card image and Product data for one fragrance. */
export function productMeta(f: Fragrance, origin: string, image = f.imageUrl): PageMeta {
  const path = paths.product(f.slug);
  const sentence = (t: string | undefined) => (t ? `${t.trim().replace(/[.\s]+$/, "")}. ` : "");
  const description = clip(`${f.name}: ${sentence(f.tagline)}${sentence(referenceLine(f))}${f.story ?? ""}`, 158);
  const offers = skusInGroup(f, "wear")
    .filter((s) => s.status !== "hidden")
    .map((s) => ({
      "@type": "Offer",
      name: `${f.name} — ${s.def.name}`,
      sku: s.code,
      price: (s.price / 100).toFixed(2),
      priceCurrency: "AUD",
      availability:
        s.status === "coming_soon"
          ? "https://schema.org/PreOrder"
          : !s.buyable
            ? "https://schema.org/OutOfStock"
            : s.stock > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/MadeToOrder",
      url: absolute(path, origin),
    }));
  return {
    title: productTitle(f),
    description,
    path,
    image,
    type: "product",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: f.name,
      description: clip(f.story || description, 500),
      sku: f.slug,
      brand: { "@type": "Brand", name: SITE_NAME },
      ...(image ? { image: [absolute(image, origin)] } : {}),
      ...(offers.length ? { offers } : {}),
    },
  };
}

/** The <head> tags for a page, as HTML (for the prerendered files). */
export function headTags(m: PageMeta, origin: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const url = absolute(m.path ?? "/", origin);
  const tags = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="${m.type ?? "website"}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    m.image ? `<meta property="og:image" content="${esc(absolute(m.image, origin))}" />` : "",
    `<meta name="twitter:card" content="summary_large_image" />`,
    // "<" is escaped so no string in the data can close the script element.
    m.jsonLd ? `<script type="application/ld+json">${JSON.stringify(m.jsonLd).replace(/</g, "\\u003c")}</script>` : "",
  ];
  return tags.filter(Boolean).join("\n    ");
}

function setTag(selector: string, create: () => HTMLElement, attr: string, value: string | undefined): void {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (value == null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function applyMeta(m: PageMeta): void {
  const origin = window.location.origin;
  const url = m.path ? absolute(m.path, origin) : undefined;
  const meta = (attr: "name" | "property", key: string) => () => {
    const el = document.createElement("meta");
    el.setAttribute(attr, key);
    return el;
  };
  document.title = m.title;
  setTag('meta[name="description"]', meta("name", "description"), "content", m.description);
  setTag('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }), "href", url);
  setTag('meta[property="og:type"]', meta("property", "og:type"), "content", m.type ?? "website");
  setTag('meta[property="og:title"]', meta("property", "og:title"), "content", m.title);
  setTag('meta[property="og:description"]', meta("property", "og:description"), "content", m.description);
  setTag('meta[property="og:url"]', meta("property", "og:url"), "content", url ?? window.location.href);
  setTag('meta[property="og:image"]', meta("property", "og:image"), "content", m.image ? absolute(m.image, origin) : undefined);
  const ld = document.head.querySelector('script[type="application/ld+json"]');
  if (m.jsonLd) {
    const el = ld ?? document.head.appendChild(Object.assign(document.createElement("script"), { type: "application/ld+json" }));
    el.textContent = JSON.stringify(m.jsonLd);
  } else ld?.remove();
}

/**
 * Sets the page's tags while the component is mounted, then returns them to
 * the storefront defaults — not to whatever was there before, since a visitor
 * who landed on a prerendered fragrance page starts with that fragrance's tags.
 */
export function usePageMeta(m: PageMeta | null): void {
  const key = m ? JSON.stringify(m) : "";
  useEffect(() => {
    if (!key) return;
    applyMeta(JSON.parse(key) as PageMeta);
    return () => applyMeta(DEFAULT_META);
  }, [key]);
}
