// Readable page content for crawlers that don't run JavaScript.
//
// Every page is the app shell, and the app draws the page in the browser. Most
// AI crawlers (and link previews) read the HTML as delivered, so without this
// they see a title and an empty <div id="root">. scripts/prerender.mjs writes
// snapshotHtml() inside #root: the same facts the page shows — name, what it
// is inspired by, notes, sizes, prices, delivery — as plain HTML. The app
// replaces it as soon as it starts (createRoot().render), so shoppers see the
// storefront as usual; anyone without JavaScript still gets a working page of
// real links. llmsTxt() is the site summarised for /llms.txt.

import { type Fragrance, money } from "./data";
import {
  DISCOVERY_BOX_PRICE,
  DISCOVERY_BOX_SIZE,
  FORMAT_BY_KEY,
  SUBSCRIPTION_DISCOUNT,
  SUBSCRIPTION_MONTHS,
  fromPrice,
  profileOf,
  referenceLine,
  referenceOf,
  relatedTo,
  sku,
  skus,
} from "./formats";
import { FREE_SHIPPING_THRESHOLD_CENTS } from "./shipping";
import { paths } from "./route";
import { LANDINGS, LANDING_BY_SLUG } from "./landings";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SHIPPING = `Free standard post within Australia on orders over ${money(FREE_SHIPPING_THRESHOLD_CENTS)}; otherwise Australia Post postage is quoted from your postcode before payment.`;
const PAYMENT = "Secure card payment on Stripe. No account needed — checking out as a guest is fine.";
const DISPATCH = "In-stock items ship within 1–2 business days; perfume and car diffusers poured to order ship within 5–7 business days.";
const HOUSE = "Maison Obsidian is a boutique perfume house in Brisbane, Queensland, hand-pouring long-lasting, extrait-strength fragrance (30% perfume oil) from oils sourced from Dubai perfumers.";
const INDEPENDENT = "Maison Obsidian is an independent fragrance house. Designer names are used only to describe a scent profile; they belong to their owners, who are not affiliated with Maison Obsidian.";

const NAV: [string, string][] = [
  ["Shop", paths.shop()],
  ["All fragrances", paths.fragrances],
  ["Discovery sets", paths.discovery],
  ["Car diffusers", paths.car],
  ["Gifts", paths.shop("gifts")],
  ["Scent DNA", paths.discover],
  ["About", paths.about],
  ["Shopping help", paths.help],
];

function frame(body: string): string {
  const nav = NAV.map(([label, to]) => `<a href="${to}" style="color:#c9a961;margin-right:16px">${esc(label)}</a>`).join("");
  return `<div class="mo-snapshot" style="max-width:880px;margin:0 auto;padding:32px 20px 48px;color:#f3ecdc;font-family:'Hanken Grotesk',system-ui,sans-serif;line-height:1.6">
<header><a href="/" style="color:#f3ecdc;text-decoration:none;font-family:'Cormorant Garamond',serif;font-size:24px;letter-spacing:.14em">MAISON OBSIDIAN</a><nav aria-label="Primary" style="margin-top:10px;font-size:14px">${nav}</nav></header>
<main>${body}</main>
<footer style="margin-top:40px;font-size:13px;color:rgba(243,236,220,.6)"><p>Shop by note: ${LANDINGS.filter((l) => !l.slug.startsWith("gifts")).map((l) => `<a href="${paths.shop(l.slug)}" style="color:#c9a961">${esc(l.chip)}</a>`).join(" · ")}</p><p>${esc(HOUSE)}</p><p>${esc(SHIPPING)} ${esc(PAYMENT)}</p><p>${esc(INDEPENDENT)}</p></footer>
</div>`;
}

const h1 = (t: string) => `<h1 style="font-family:'Cormorant Garamond',serif;font-weight:400;font-size:44px;line-height:1.05;margin:28px 0 8px">${esc(t)}</h1>`;
const h2 = (t: string) => `<h2 style="font-family:'Cormorant Garamond',serif;font-weight:400;font-size:28px;margin:28px 0 8px">${esc(t)}</h2>`;
const p = (t: string) => `<p>${esc(t)}</p>`;

/** One line per fragrance: name, what it's inspired by, profile, entry price. */
function list(frags: Fragrance[]): string {
  return `<ul>${frags
    .map((f) => `<li><a href="${paths.product(f.slug)}" style="color:#c9a961">${esc(f.name)}</a> — ${esc(referenceLine(f))}. ${esc(profileOf(f).join(", "))}. From ${money(fromPrice(f))}.</li>`)
    .join("")}</ul>`;
}

function product(f: Fragrance, all: Fragrance[]): string {
  const offers = skus(f)
    .map((s) => `<li>${esc(s.def.name)} — ${money(s.price)} — ${esc(s.availability)}</li>`)
    .join("");
  const notes = [
    ["Top notes", f.top],
    ["Heart notes", f.heart],
    ["Base notes", f.base],
  ]
    .filter(([, n]) => n.length)
    .map(([label, n]) => `<li>${esc(label as string)}: ${esc((n as string[]).join(", "))}</li>`)
    .join("");
  const related = relatedTo(f, all, 4);
  return frame(
    `<nav aria-label="Breadcrumb" style="font-size:13px"><a href="/" style="color:#c9a961">Home</a> / <a href="${paths.fragrances}" style="color:#c9a961">Fragrances</a> / ${esc(f.name)}</nav>` +
      h1(f.name) +
      `<p style="font-size:20px;color:#c9a961">${esc(referenceLine(f))}</p>` +
      p(`Scent profile: ${profileOf(f).join(", ")}.`) +
      (f.tagline ? p(f.tagline) : "") +
      (f.story ? p(f.story) : "") +
      (notes ? h2("Notes") + `<ul>${notes}</ul>` : "") +
      h2("Sizes and prices") +
      `<ul>${offers}</ul>` +
      p(`New to this scent? Try it as a 10 ml first, or choose any ${DISCOVERY_BOX_SIZE} fragrances as a Discovery Box for ${money(DISCOVERY_BOX_PRICE)}.`) +
      h2("Delivery and payment") +
      p(`${SHIPPING} ${DISPATCH} ${PAYMENT}`) +
      (related.length ? h2("You may also like") + list(related) : ""),
  );
}

type Page = { title: string; intro: string[]; frags?: Fragrance[] };

function pageFor(path: string, frags: Fragrance[]): Page | null {
  const car = frags.filter((f) => sku(f, "car").status === "live");
  switch (path) {
    case "/":
      return {
        title: "Arabian perfume, hand-poured in Brisbane",
        intro: [
          "Arabian and designer-inspired perfume for Australia, hand-poured in Brisbane at extrait strength from Dubai-sourced oils, so it lasts all day. It smells like the expensive perfume you love, and comes as perfume, car diffusers and body care, delivered Australia-wide.",
          `Every scent comes in three sizes: 10 ml to try (${money(sku(frags[0], "perf10").price)}), 30 ml for everyday (${money(sku(frags[0], "perf30").price)}) and 50 ml signature (${money(sku(frags[0], "perf50").price)}). Build a Discovery Box of any ${DISCOVERY_BOX_SIZE} scents in 10 ml for ${money(DISCOVERY_BOX_PRICE)}.`,
          "Not sure where to start? Name a fragrance you already love and we'll match it, or take the Scent DNA quiz.",
        ],
        frags,
      };
    case "/fragrances":
    case "/shop":
      return {
        title: path === "/shop" ? "Niche perfume, every way in" : "Extrait de parfum, hand-poured",
        intro: [
          path === "/shop"
            ? "Boutique niche perfume from Australia: every Maison Obsidian scent, with the designer fragrance that inspired it, in 10 ml, 30 ml and 50 ml."
            : "Extrait de parfum in Australia — 30% perfume oil sourced from Dubai, hand-poured in small batches in Brisbane, so it lasts all day. Every scent in 10 ml, 30 ml and 50 ml, with the designer fragrance that inspired it.",
        ],
        frags,
      };
    case "/new":
      return { title: "New arrivals", intro: ["The latest fragrances from Maison Obsidian, freshly poured in small batches."], frags };
    case "/discovery":
      return {
        title: "Perfume samples. Try before you buy.",
        intro: [`Perfume samples in Australia, at full extrait strength: a fragrance discovery set of any ${DISCOVERY_BOX_SIZE} scents as 10 ml perfume for ${money(DISCOVERY_BOX_PRICE)}, or single 10 ml perfumes. Choose any ${DISCOVERY_BOX_SIZE} fragrances as 10 ml eau de parfum for ${money(DISCOVERY_BOX_PRICE)}, or buy single 10 ml discoveries. Wear each for a few days, then choose your 30 ml or 50 ml.`],
        frags,
      };
    case "/car":
      return {
        title: "Luxury car diffusers",
        intro: [`Luxury car diffusers and car perfume for Australia — every scent, from oud car fresheners to fresh citrus, as a hanging ${FORMAT_BY_KEY.car.name.toLowerCase()} with a wooden cap${car[0] ? `, ${money(sku(car[0], "car").price)} each` : ""}.`],
        frags: car,
      };
    case "/body":
      return {
        title: "Body wash, moisturiser and sets",
        intro: ["The Obsidian Ritual: body wash, moisturiser and the Complete Ritual set in Maison Obsidian fragrances, to layer the scent from morning to night. Body care is coming soon; sign up on any fragrance page to hear when it arrives."],
      };
    case "/subscribe":
      return {
        title: "The Monthly Pour",
        intro: [
          `A perfume subscription: choose a 10, 30 or 50 ml eau de parfum or the car diffuser, then pick your fragrance each month at ${Math.round(SUBSCRIPTION_DISCOUNT * 100)}% under the shelf price. A ${SUBSCRIPTION_MONTHS}-month plan, billed monthly; cancel from your account.`,
        ],
      };
    case "/discover":
      return {
        title: "Discover your Scent DNA",
        intro: ["A short quiz that reads your scent preferences and recommends Maison Obsidian fragrances to try, with a shareable Scentprint."],
      };
    case "/about":
      return {
        title: "Handmade perfume, poured in Brisbane",
        intro: [
          HOUSE,
          "Discover it. Wear it. Drive with it. Live in it. Maison Obsidian is a batch atelier: each fragrance is poured in small numbers and offered in every format your day needs — eau de parfum in 10, 30 and 50 ml, a car diffuser, and body care.",
          "Each scent is inspired by the profile of a well-known designer fragrance, so you can find yours by a scent you already love.",
        ],
      };
    case "/help":
      return {
        title: "Shopping help",
        intro: [
          "Start with a fragrance, then choose an available bottle size or car diffuser. Products marked coming soon cannot be ordered yet. For a smaller introduction, try the 10 ml discovery range.",
          `Postal orders need an Australian address and a postage quote before payment. ${SHIPPING} ${DISPATCH}`,
          PAYMENT,
          "Alternate delivery is for arrangements made directly with the house; include a contact number and clear delivery instructions.",
        ],
      };
    default: {
      const landing = path.startsWith("/shop/") ? LANDING_BY_SLUG[path.slice(6)] : undefined;
      return landing ? { title: landing.h1, intro: [landing.intro], frags: frags.filter(landing.matches) } : null;
    }
  }
}

/** The readable HTML for a page, or null for a path it doesn't cover. */
export function snapshotHtml(path: string, frags: Fragrance[]): string | null {
  const m = /^\/fragrance\/([^/]+)$/.exec(path);
  if (m) {
    const f = frags.find((x) => x.slug === m[1]);
    return f ? product(f, frags) : null;
  }
  const page = frags.length ? pageFor(path, frags) : null;
  if (!page) return null;
  return frame(h1(page.title) + page.intro.map(p).join("") + (page.frags?.length ? h2(path === "/" ? "The collection" : "Fragrances") + list(page.frags) : ""));
}

/** The site summarised for language models: https://llmstxt.org */
export function llmsTxt(frags: Fragrance[], origin: string): string {
  const f0 = frags[0];
  const sizes = f0 ? `10 ml ${money(sku(f0, "perf10").price)}, 30 ml ${money(sku(f0, "perf30").price)}, 50 ml ${money(sku(f0, "perf50").price)}, car diffuser ${money(sku(f0, "car").price)}` : "";
  const line = (f: Fragrance) => {
    const r = referenceOf(f);
    return `- [${f.name}](${origin}${paths.product(f.slug)}): inspired by ${r.brand}${r.fragrance ? ` ${r.fragrance}` : ""}. ${profileOf(f).join(", ")}. From ${money(fromPrice(f))}.`;
  };
  return `# Maison Obsidian

> Boutique perfume house in Brisbane, Queensland, hand-pouring long-lasting Arabian and designer-inspired perfume at extrait strength (30% perfume oil, sourced from Dubai perfumers). Sold online at ${origin} with delivery across Australia: 10 ml samples, 30 and 50 ml bottles, luxury car diffusers, and (coming soon) body care.

${INDEPENDENT}

## Buying

- Prices (AUD, every fragrance): ${sizes}.
- Discovery Box: any ${DISCOVERY_BOX_SIZE} fragrances in 10 ml for ${money(DISCOVERY_BOX_PRICE)}.
- The Monthly Pour subscription: ${Math.round(SUBSCRIPTION_DISCOUNT * 100)}% off, ${SUBSCRIPTION_MONTHS}-month plan billed monthly, a new fragrance each month.
- Delivery: ${SHIPPING}
- Dispatch: ${DISPATCH}
- Payment: ${PAYMENT}

## Find a fragrance

- [Match a fragrance you love](${origin}${paths.find()}): name a designer fragrance and get the closest Maison Obsidian scent.
- [Scent DNA quiz](${origin}${paths.discover})
- [All fragrances](${origin}${paths.fragrances})
- [Discovery Box](${origin}${paths.discovery})
- [Car diffusers](${origin}${paths.car})
- [Perfume gifts](${origin}${paths.shop("gifts")})
- [Shopping help](${origin}${paths.help})

## Shop by note or season

${LANDINGS.filter((l) => !l.slug.startsWith("gifts")).map((l) => `- [${l.eyebrow}](${origin}${paths.shop(l.slug)})`).join("\n")}

## Fragrances

${frags.map(line).join("\n")}
`;
}
