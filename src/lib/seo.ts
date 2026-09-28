// What a page tells search engines and social cards: title, description,
// canonical URL, Open Graph tags and, for a fragrance, schema.org Product data.
//
// scripts/prerender.mjs uses productMeta() at build time to write a static
// page per fragrance (crawlers and link previews read the HTML without running
// the app); usePageMeta() keeps the tags right as the shopper moves around.

import { useEffect } from "react";
import { type Fragrance, money } from "./data";
import { availabilityOf, DISCOVERY_BOX_PRICE, DISCOVERY_BOX_SIZE, formatParam, referenceLine, referenceOf, skusInGroup, sku as skuOf, SUBSCRIPTION_DISCOUNT, SUBSCRIPTION_MONTHS, type Sku } from "./formats";
import { paths } from "./route";
import type { RatingSummary } from "./reviews";

export const SITE_NAME = "Maison Obsidian";

/**
 * The storefront's own tags, as in index.html. Payment is taken in full at
 * checkout (api/stripe/checkout.ts), so nothing here may promise otherwise.
 */
export const DEFAULT_META: PageMeta = {
  title: "Designer-Inspired Perfume Australia | Maison Obsidian",
  description:
    "Designer-inspired eau de parfum, poured in small batches and shipped Australia-wide. Meet any scent as a 10 ml discovery, then choose 30 ml or 50 ml — or take it in the car.",
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
  /** e.g. "noindex" for a page that should stay out of search. */
  robots?: string;
  jsonLd?: Record<string, unknown>;
}

/**
 * The canonical origin in the browser: VITE_SITE_URL when set (so a preview
 * deployment or the other of www / bare domain still names the real site),
 * else wherever the page is served. Keep it equal to SITE_URL for the build.
 */
export function siteOrigin(): string {
  const configured = String(import.meta.env.VITE_SITE_URL ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^/\s]+$/.test(configured) ? configured : window.location.origin;
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function absolute(url: string, origin: string): string {
  return /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** The house as an Organization, with its official profiles as sameAs. */
export function organizationJsonLd(origin: string, sameAs: string[] = []): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: SITE_NAME,
    url: `${origin}/`,
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/**
 * Title and description for the storefront's own pages — the ones a shopper
 * searches their way into: the discovery box, the car diffusers, the range.
 * Shared by scripts/prerender.mjs (a static page each) and the app. /shop/<facet>
 * filters are canonical to /shop so they don't compete with it.
 */
export function staticPageMeta(path: string, origin: string, sameAs: string[] = []): PageMeta | null {
  const pages: Record<string, Omit<PageMeta, "path">> = {
    "/": {
      ...DEFAULT_META,
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          organizationJsonLd(origin, sameAs),
          { "@type": "WebSite", "@id": `${origin}/#website`, name: SITE_NAME, url: `${origin}/`, publisher: { "@id": `${origin}/#organization` } },
        ],
      },
    },
    "/fragrances": {
      title: "Designer-Inspired Perfumes in 10, 30 & 50 ml | Maison Obsidian",
      description:
        "Every Maison Obsidian eau de parfum, browsable by the designer scent that inspired it. 30% extrait, poured in small batches: meet each in 10 ml, live in it at 30 ml, sign it at 50 ml.",
    },
    "/shop": {
      title: "Shop Perfume by Scent, Mood & Format | Maison Obsidian",
      description:
        "Shop designer-inspired eau de parfum by who it's for, the mood you're after — woody, fresh, gourmand, floral — or the format: 10 ml, 30 ml, 50 ml or car diffuser.",
    },
    "/discovery": {
      title: "Build Your Own Perfume Discovery Box | Maison Obsidian Australia",
      description: `Choose any ${DISCOVERY_BOX_SIZE} fragrances as 10 ml eau de parfum for ${money(DISCOVERY_BOX_PRICE)}, or buy single 10 ml discoveries. Wear each for a week, then choose your 30 ml or 50 ml.`,
    },
    "/car": {
      title: "Car Perfume Diffusers in Your Favourite Scents | Maison Obsidian",
      description:
        "Obsidian Drive: every Maison Obsidian fragrance as a 10 ml car diffuser with a wooden cap. Match your car to the scent you wear, or add one to a perfume order.",
    },
    "/body": {
      title: "Body Wash, Moisturiser & Fragrance Sets | Maison Obsidian",
      description: "The Obsidian Ritual: body wash, moisturiser and the Complete Ritual set in your Maison Obsidian fragrance. Layer the scent from morning to night.",
    },
    "/subscribe": {
      title: "The Monthly Pour — Perfume Subscription | Maison Obsidian",
      description: `A bottle a month for ${SUBSCRIPTION_MONTHS} months at ${Math.round(SUBSCRIPTION_DISCOUNT * 100)}% under the shelf price. Choose the size, then the scent each month.`,
    },
    "/new": {
      title: "New arrivals | Maison Obsidian",
      description: "The latest fragrances from Maison Obsidian, freshly poured in small batches. Meet them in 10 ml or go straight to the 50 ml.",
    },
    "/about": {
      title: "About Maison Obsidian | Small-Batch Designer-Inspired Perfume",
      description:
        "Maison Obsidian pours designer-inspired fragrance in small batches and offers each scent as eau de parfum, a car diffuser and body care. Discover it, wear it, drive with it.",
    },
    "/help": {
      title: "Shopping Help: Delivery, Payment & Returns | Maison Obsidian",
      description:
        "How ordering works at Maison Obsidian: choosing a size or car diffuser, Australia Post delivery quotes, paying at checkout with Stripe, and getting support.",
    },
  };
  const key = path.startsWith("/shop/") ? "/shop" : path;
  const page = pages[key];
  return page ? { ...page, path: key } : null;
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

/** schema.org Offer for one SKU, landing on the page with that SKU chosen. */
function offerFor(f: Fragrance, s: Sku, origin: string): Record<string, unknown> {
  return {
    "@type": "Offer",
    url: absolute(paths.product(f.slug, formatParam(s.key)), origin),
    price: (s.price / 100).toFixed(2),
    priceCurrency: "AUD",
    availability: availabilityOf(s).schema,
    itemCondition: "https://schema.org/NewCondition",
  };
}

/**
 * Title, description, card image and structured data for one fragrance.
 *
 * The eau de parfum sizes are one ProductGroup varying by size, each size its
 * own Product and Offer (Google's product-variant markup). The car diffuser is
 * a different product, not a size, so it is its own Product alongside.
 */
export function productMeta(f: Fragrance, origin: string, image = f.imageUrl, rating: RatingSummary | null = null): PageMeta {
  const path = paths.product(f.slug);
  const url = absolute(path, origin);
  const sentence = (t: string | undefined) => (t ? `${t.trim().replace(/[.\s]+$/, "")}. ` : "");
  const description = clip(`${f.name}: ${sentence(f.tagline)}${sentence(referenceLine(f))}${f.story ?? ""}`, 158);
  const images = image ? [absolute(image, origin)] : undefined;
  const brand = { "@type": "Brand", name: SITE_NAME };
  const longDescription = clip(f.story || description, 500);
  const sizes = skusInGroup(f, "wear");
  const car = skuOf(f, "car");
  const aggregateRating = rating
    ? { "@type": "AggregateRating", ratingValue: rating.average.toFixed(1), reviewCount: rating.count, bestRating: 5, worstRating: 1 }
    : undefined;

  const perfume: Record<string, unknown> = sizes.length
    ? {
        "@type": "ProductGroup",
        "@id": `${url}#product`,
        name: f.name,
        description: longDescription,
        url,
        brand,
        productGroupID: f.slug.toUpperCase(),
        variesBy: ["https://schema.org/size"],
        ...(images ? { image: images } : {}),
        ...(aggregateRating ? { aggregateRating } : {}),
        hasVariant: sizes.map((s) => ({
          "@type": "Product",
          name: `${f.name} ${s.def.name}`,
          sku: s.code,
          size: `${s.def.sizeMl} ml`,
          ...(images ? { image: images } : {}),
          offers: offerFor(f, s, origin),
        })),
      }
    : {
        "@type": "Product",
        "@id": `${url}#product`,
        name: f.name,
        description: longDescription,
        url,
        brand,
        sku: f.slug.toUpperCase(),
        ...(images ? { image: images } : {}),
        ...(aggregateRating ? { aggregateRating } : {}),
      };

  const graph: Record<string, unknown>[] = [perfume];
  if (car.status !== "hidden") {
    graph.push({
      "@type": "Product",
      "@id": `${url}#car-diffuser`,
      name: `${f.name} ${car.def.name}`,
      description: `${f.name} as a ${car.def.sizeMl} ml car diffuser. ${sentence(f.tagline)}`.trim(),
      sku: car.code,
      brand,
      ...(images ? { image: images } : {}),
      offers: offerFor(f, car, origin),
    });
  }
  graph.push({
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: "Fragrances", item: absolute(paths.fragrances, origin) },
      { "@type": "ListItem", position: 3, name: f.name, item: url },
    ],
  });

  return {
    title: productTitle(f),
    description,
    path,
    image,
    type: "product",
    jsonLd: { "@context": "https://schema.org", "@graph": graph },
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
    m.robots ? `<meta name="robots" content="${esc(m.robots)}" />` : "",
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
  const origin = siteOrigin();
  const url = m.path ? absolute(m.path, origin) : undefined;
  const meta = (attr: "name" | "property", key: string) => () => {
    const el = document.createElement("meta");
    el.setAttribute(attr, key);
    return el;
  };
  document.title = m.title;
  setTag('meta[name="description"]', meta("name", "description"), "content", m.description);
  setTag('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }), "href", url);
  setTag('meta[name="robots"]', meta("name", "robots"), "content", m.robots);
  setTag('meta[property="og:type"]', meta("property", "og:type"), "content", m.type ?? "website");
  setTag('meta[property="og:title"]', meta("property", "og:title"), "content", m.title);
  setTag('meta[property="og:description"]', meta("property", "og:description"), "content", m.description);
  setTag('meta[property="og:url"]', meta("property", "og:url"), "content", url ?? window.location.href);
  setTag('meta[property="og:image"]', meta("property", "og:image"), "content", m.image ? absolute(m.image, origin) : undefined);
  const ld = document.head.querySelector('script[type="application/ld+json"]');
  if (m.jsonLd) {
    const el = ld ?? document.head.appendChild(Object.assign(document.createElement("script"), { type: "application/ld+json" }));
    el.textContent = JSON.stringify(m.jsonLd).replace(/</g, "\\u003c");
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
