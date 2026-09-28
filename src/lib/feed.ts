// Google Merchant Center product feed (RSS 2.0 with the g: namespace), written
// by scripts/prerender.mjs to dist/merchant-feed.xml. One item per purchasable
// SKU — each eau de parfum size and the car diffuser — priced and stocked by
// the same code the product page and its structured data use, and linked to
// the page opened on that SKU, so feed, page and markup agree.
//
// Deliberately left out:
//   • third-party brand names. The "inspired by" reference is on the page, but
//     brand names in Shopping titles and descriptions invite counterfeit-policy
//     disapprovals; add them only after that wording has been reviewed.
//   • shipping. Postage is an Australia Post quote per parcel with free
//     standard post over $100; set it up as a shipping service in Merchant
//     Center rather than a flat per-item price here.
//   • VIP-only and unlaunched scents, and coming-soon formats (Google needs an
//     availability date for pre-orders).

import type { Fragrance } from "./data";
import { availabilityOf, formatParam, skus, type Sku } from "./formats";
import { paths } from "./route";

const CATEGORY = {
  wear: "Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne",
  drive: "Vehicles & Parts > Vehicle Parts & Accessories > Vehicle Maintenance, Care & Decor > Vehicle Decor > Vehicle Air Fresheners",
} as const;

const GENDER = { masculine: "male", feminine: "female", unisex: "unisex" } as const;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** Tagline and notes: what the scent is, in words that are the house's own. */
function describe(f: Fragrance, s: Sku): string {
  const notes = [
    f.top.length ? `Top notes: ${f.top.join(", ")}.` : "",
    f.heart.length ? `Heart: ${f.heart.join(", ")}.` : "",
    f.base.length ? `Base: ${f.base.join(", ")}.` : "",
  ].filter(Boolean);
  const what = s.def.group === "drive" ? `${f.name} as a ${s.def.sizeMl} ml car diffuser.` : `${f.name} ${s.def.name}.`;
  return clip([what, f.tagline, ...notes].filter(Boolean).join(" "), 5000);
}

export interface FeedOptions {
  origin: string;
  /** Absolute or site-relative image for a fragrance. */
  imageFor: (f: Fragrance) => string;
}

export function feedItems(frags: Fragrance[], { origin, imageFor }: FeedOptions): string[] {
  const abs = (u: string) => (/^https?:\/\//.test(u) ? u : `${origin}${u.startsWith("/") ? "" : "/"}${u}`);
  const out: string[] = [];
  for (const f of frags) {
    if (f.vipOnly) continue;
    for (const s of skus(f)) {
      const group = s.def.group;
      if ((group !== "wear" && group !== "drive") || s.status !== "live") continue;
      const a = availabilityOf(s);
      const fields: [string, string][] = [
        ["g:id", s.code],
        ...(group === "wear" ? ([["g:item_group_id", f.slug.toUpperCase()]] as [string, string][]) : []),
        ["g:title", clip(`${f.name} ${s.def.name} | Maison Obsidian`, 150)],
        ["g:description", describe(f, s)],
        ["g:link", abs(paths.product(f.slug, formatParam(s.key)))],
        ["g:image_link", abs(imageFor(f))],
        ["g:availability", a.feed],
        ["g:price", `${(s.price / 100).toFixed(2)} AUD`],
        ["g:brand", "Maison Obsidian"],
        ["g:condition", "new"],
        ["g:identifier_exists", "no"],
        ["g:google_product_category", CATEGORY[group]],
        ["g:product_type", group === "wear" ? `Eau de Parfum > ${s.def.label}` : "Car Diffuser"],
        ...(group === "wear" ? ([["g:size", `${s.def.sizeMl} ml`], ["g:gender", GENDER[f.gender]]] as [string, string][]) : []),
        ...(a.handlingDays
          ? ([["g:min_handling_time", String(a.handlingDays[0])], ["g:max_handling_time", String(a.handlingDays[1])]] as [string, string][])
          : []),
      ];
      out.push(`    <item>\n${fields.map(([k, v]) => `      <${k}>${esc(v)}</${k}>`).join("\n")}\n    </item>`);
    }
  }
  return out;
}

export function merchantFeed(frags: Fragrance[], opts: FeedOptions): { xml: string; count: number } {
  const items = feedItems(frags, opts);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Maison Obsidian</title>
    <link>${esc(opts.origin)}/</link>
    <description>Maison Obsidian eau de parfum and car diffusers</description>
${items.join("\n")}
  </channel>
</rss>
`;
  return { xml, count: items.length };
}
