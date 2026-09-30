// After `vite build`: a static page per fragrance and per storefront page, a
// sitemap, robots.txt, llms.txt and the Merchant Center product feed.
//
// The storefront is a single-page app, so without this every URL serves the
// same index.html: one title, one description, one social card. Crawlers and
// link previews (iMessage, Facebook, Instagram) read the HTML without running
// the app, so each fragrance gets its own copy of index.html at
// dist/fragrance/<slug>/index.html with its title, description, canonical URL,
// Open Graph image and schema.org Product data in the head. The body is the
// same app, which takes over as usual. Vercel serves these files before the
// SPA fallback in vercel.json.
//
// The catalogue is the live one (Supabase, anon key — the same public read the
// storefront does), else the seed in src/lib/data.ts.
//
// The storefront's own pages (/discovery, /car, /fragrances …) get the same
// treatment from staticPageMeta(), so each has its own title, description and
// canonical URL before any script runs.
//
// Each page also carries its content as plain HTML inside #root
// (src/lib/snapshot.ts), for AI crawlers and anything else that reads the page
// without running it; the app replaces it on start. The home page's
// index.html gets its content too, so the SPA fallback for every other path
// is a separate, empty app.html (vercel.json).
//
// dist/merchant-feed.xml lists every purchasable SKU for Google Merchant
// Center (src/lib/feed.ts); add it there as a scheduled fetch.
//
// Env: VITE_SITE_URL, the canonical origin (e.g. https://www.maisonobsidian.com.au,
// the host the other of www / bare domain redirects to), read here and by the
// app. Without it, SITE_URL, then Vercel's production domain — which is the
// *shortest* custom domain, and so may be the one that redirects away. VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY as for the app.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { loadEnv } from "vite";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const env = { ...loadEnv("production", root, ""), ...process.env };

const origin = (
  env.VITE_SITE_URL ||
  env.SITE_URL ||
  (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
  "https://www.maisonobsidian.com.au"
).replace(/\/+$/, "");

// The app's own catalogue and SEO code, so the tags match what the page shows.
// Inside the project, so the bundle can resolve react from node_modules.
const bundle = join(root, "node_modules", ".cache", `mo-prerender-${process.pid}.mjs`);
await build({
  stdin: {
    contents: [
      `export { FRAGS, withBottleImage } from "./src/lib/data";`,
      `export { productMeta, staticPageMeta, headTags } from "./src/lib/seo";`,
      `export { merchantFeed } from "./src/lib/feed";`,
      `export { socialProfiles } from "./src/lib/social";`,
      `export { isLaunched } from "./src/lib/launch";`,
      `export { snapshotHtml, llmsTxt } from "./src/lib/snapshot";`,
    ].join("\n"),
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["react"],
  outfile: bundle,
  logLevel: "error",
});
const { FRAGS, withBottleImage, productMeta, staticPageMeta, headTags, merchantFeed, socialProfiles, isLaunched, snapshotHtml, llmsTxt } = await import(pathToFileURL(bundle).href);
await rm(bundle, { force: true });

/** Mirrors rowToFragrance() in src/lib/store.ts. */
function rowToFragrance(r) {
  return withBottleImage({
    id: r.id,
    slug: r.slug,
    name: r.name,
    inspiration: r.inspiration,
    tagline: r.tagline,
    story: r.story,
    price: r.price_50ml_cents,
    price10: r.price_10ml_cents,
    price30: r.price_30ml_cents,
    gender: r.gender,
    moq: r.moq,
    committed: r.committed,
    liquid: r.liquid,
    accent: r.accent,
    vipOnly: r.vip_only,
    top: r.top ?? [],
    heart: r.heart ?? [],
    base: r.base ?? [],
    stock10: r.stock_10ml,
    stock30: r.stock_30ml,
    stock50: r.stock_50ml,
    imageUrl: r.image_url ?? undefined,
    profile: r.profile ?? [],
    formatPrices: r.format_prices ?? undefined,
    formatStatus: r.format_status ?? undefined,
    stockCar: r.stock_car,
    stockWash: r.stock_wash,
    stockMoist: r.stock_moist,
    launchAt: r.launch_at ?? undefined,
  });
}

async function catalogue() {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/fragrances?select=*&order=sort_order.asc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length) return { source: "Supabase", frags: rows.map(rowToFragrance) };
    } catch (e) {
      console.warn(`prerender: live catalogue unavailable (${e instanceof Error ? e.message : e}); using the seed`);
    }
  }
  return { source: "seed", frags: FRAGS };
}

/** Published review ratings per fragrance id, for aggregateRating. */
async function ratings() {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  const out = new Map();
  if (!url || !key) return out;
  try {
    const res = await fetch(`${url}/rest/v1/reviews?select=fragrance_id,rating&status=eq.published`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    for (const r of await res.json()) {
      const cur = out.get(r.fragrance_id) ?? { sum: 0, count: 0 };
      out.set(r.fragrance_id, { sum: cur.sum + r.rating, count: cur.count + 1 });
    }
  } catch (e) {
    console.warn(`prerender: review ratings unavailable (${e instanceof Error ? e.message : e})`);
  }
  return new Map([...out].map(([id, { sum, count }]) => [id, { average: sum / count, count }]));
}

/** A card image that exists: the fragrance's own, else the house shot. */
function cardImage(f) {
  const u = f.imageUrl;
  if (u && /^https?:\/\//.test(u)) return u;
  if (u && existsSync(join(dist, decodeURIComponent(u)))) return u;
  return "/assets/bottle-pair.png";
}

const template = await readFile(join(dist, "index.html"), "utf8");
// The empty shell every path without a page of its own falls back to.
await writeFile(join(dist, "app.html"), template);

/** The page's readable content inside #root, when there is some. */
const withContent = (html, path, frags) => {
  const body = snapshotHtml(path, frags);
  return body ? html.replace(/<div id="root"><\/div>/, () => `<div id="root">${body}</div>`) : html;
};
// The shell's generic tags give way to the page's own.
const shell = template
  .replace(/\s*<title>[\s\S]*?<\/title>/, "")
  .replace(/\s*<meta\s+(?:name="description"|property="og:[^"]+"|name="twitter:[^"]+")[\s\S]*?\/>/g, "")
  .replace(/\s*<!-- Social cards\.[\s\S]*?-->/, "");

const [{ source, frags }, rated] = await Promise.all([catalogue(), ratings()]);
// Not launched yet: no page, no sitemap entry, no feed item (the app shows it
// from launch day).
const launched = frags.filter((f) => f.slug && /^[a-z0-9-]+$/.test(f.slug) && isLaunched(f));
const pages = [];
for (const f of launched) {
  const meta = productMeta(f, origin, cardImage(f), rated.get(f.id) ?? null);
  const html = withContent(shell.replace(/\s*<\/head>/, `\n    ${headTags(meta, origin)}\n  </head>`), meta.path, launched);
  const dir = join(dist, "fragrance", f.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), html);
  pages.push(meta.path);
}

// Storefront pages worth indexing; the account, checkout, admin and staff
// screens are not. Each but the home page gets its own head, as above; the
// home page's index.html is also the app shell every other path falls back to,
// so it keeps the generic tags and the app adds the rest.
const statics = ["/", "/new", "/fragrances", "/shop", "/discovery", "/car", "/body", "/subscribe", "/discover", "/about", "/help"];
const sameAs = socialProfiles(env).map((p) => p.url);
let staticCount = 0;
for (const p of statics) {
  if (p === "/") {
    await writeFile(join(dist, "index.html"), withContent(template, "/", launched));
    continue;
  }
  const meta = staticPageMeta(p, origin, sameAs);
  if (!meta) continue;
  const dir = join(dist, p.slice(1));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), withContent(shell.replace(/\s*<\/head>/, `\n    ${headTags({ image: "/assets/bottle-pair.png", ...meta }, origin)}\n  </head>`), p, launched));
  staticCount++;
}
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...statics, ...pages].map((p) => `  <url><loc>${origin}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`;
await writeFile(join(dist, "sitemap.xml"), sitemap);

await writeFile(
  join(dist, "robots.txt"),
  `User-agent: *
Allow: /
Disallow: /admin
Disallow: /staff
Disallow: /account
Disallow: /checkout
Disallow: /thanks
Disallow: /reset
Disallow: /find
Disallow: /api/

Sitemap: ${origin}/sitemap.xml
`,
);

await writeFile(join(dist, "llms.txt"), llmsTxt(launched, origin));

const feed = merchantFeed(launched, { origin, imageFor: cardImage });
await writeFile(join(dist, "merchant-feed.xml"), feed.xml);

console.log(
  `prerender: ${pages.length} fragrance pages from the ${source} catalogue, ${staticCount} storefront pages, sitemap.xml, robots.txt, llms.txt and merchant-feed.xml (${feed.count} items) for ${origin}`,
);
