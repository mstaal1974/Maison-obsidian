// Search landing pages: /shop/<slug> for the things people search by — a note
// (oud, vanilla …), a season, a gift. Each is the collection filtered to the
// scents that fit, with its own title, heading and first sentence carrying
// the phrase it is found by, so unlike the other /shop facets it is its own
// canonical page (lib/seo.ts), prerendered and in the sitemap.
//
// Every claim here was confirmed by the house: extrait-strength oils sourced
// from Dubai perfumers, hand-poured in Brisbane, long-lasting in wear.

import { type Fragrance, HOUSE_PRICE, money } from "./data";
import { moodsOf } from "./formats";

export interface Landing {
  slug: string;
  /** Page title, keyword first. */
  title: string;
  description: string;
  eyebrow: string;
  /** The page's h1. */
  h1: string;
  /** First paragraph; its first sentence carries the keyword. */
  intro: string;
  /** Short label for the removable filter chip. */
  chip: string;
  matches: (f: Fragrance) => boolean;
}

const notes = (f: Fragrance) => [...f.top, ...f.heart, ...f.base].join(" · ").toLowerCase();
const hasNote = (word: RegExp) => (f: Fragrance) => word.test(notes(f));
const moodIn = (...m: string[]) => (f: Fragrance) => moodsOf(f).some((x) => m.includes(x));
const all = () => true;

const noteLanding = (slug: string, word: RegExp, name: string, h1: string, why: string): Landing => ({
  slug,
  title: `${name} Perfume Australia | Extrait, Hand-Poured | Maison Obsidian`,
  description: `${name} perfume in Australia: extrait-strength eau de parfum with ${name.toLowerCase()} notes, hand-poured in Brisbane from Dubai-sourced oils. Try any scent as a 10 ml for ${money(HOUSE_PRICE.ml10)}.`,
  eyebrow: `${name} perfume`,
  h1,
  intro: `${name} perfume, hand-poured in Brisbane at extrait strength and delivered across Australia. ${why} Try any of them as a 10 ml first.`,
  chip: name,
  matches: hasNote(word),
});

export const LANDINGS: Landing[] = [
  noteLanding("oud", /\boud\b|agarwood/, "Oud", "Oud perfume, poured in Brisbane.", "Deep, resinous and long lasting — the heart of Arabian perfumery, from rose oud to smoky oud and leather."),
  noteLanding("amber", /\bamber/, "Amber", "Amber perfume, warm to the last hour.", "Glowing, resinous amber scents that sit close and last from morning to night."),
  noteLanding("musk", /\bmusk/, "Musk", "Musk perfume, soft and lasting.", "Clean, skin-close musks that linger long after you've left the room."),
  noteLanding("vanilla", /\bvanilla|tonka/, "Vanilla", "Vanilla perfume, rich and addictive.", "Warm vanilla and tonka scents, from sweet and gourmand to smoky and dark."),
  noteLanding("rose", /\brose\b/, "Rose", "Rose and rose oud perfume.", "Rose in every mood — fresh petals, velvet rose and the classic Arabian pairing of rose and oud."),
  noteLanding("leather", /\bleather|suede/, "Leather", "Leather perfume, dark and refined.", "Smoky, supple leather scents with the depth of a niche perfume house."),
  {
    slug: "winter",
    title: "Warm Perfume for Winter | Long Lasting Extrait | Maison Obsidian",
    description: "Warm perfume for winter: amber, oud, spice and vanilla at extrait strength, hand-poured in Brisbane. Long lasting in the cold. Delivered across Australia.",
    eyebrow: "Winter",
    h1: "Warm perfume for winter.",
    intro: "Warm perfume for winter — amber, oud, spice and vanilla at extrait strength, made to last through the cold months. Hand-poured in Brisbane and delivered across Australia.",
    chip: "Winter",
    matches: moodIn("Evening", "Gourmand", "Spicy", "Dark"),
  },
  {
    slug: "summer",
    title: "Fresh Perfume for Summer | Long Lasting | Maison Obsidian",
    description: "Fresh perfume for summer: citrus, aquatic and clean scents at extrait strength, so they last in the heat. Hand-poured in Brisbane, delivered across Australia.",
    eyebrow: "Summer",
    h1: "Fresh perfume for summer.",
    intro: "Fresh perfume for summer — citrus, aquatic and clean scents poured at extrait strength so they still last in Australian heat. Hand-poured in Brisbane.",
    chip: "Summer",
    matches: moodIn("Summer", "Fresh", "Clean"),
  },
  {
    slug: "gifts",
    title: "Perfume Gift Australia | Luxury Gifts Under $50 | Maison Obsidian",
    description: `Perfume gifts in Australia: a 50 ml extrait for ${money(HOUSE_PRICE.ml50)}, a luxury car diffuser for ${money(HOUSE_PRICE.car)}, or a discovery set of five. Hand-poured in Brisbane, gift sets for her and men's fragrance gifts.`,
    eyebrow: "Gifts",
    h1: "Perfume gifts, hand-poured in Brisbane.",
    intro: `Perfume gifts for Australia — luxury gifts under $50: every 50 ml extrait is ${money(HOUSE_PRICE.ml50)}, a hanging car diffuser ${money(HOUSE_PRICE.car)}, and 50 ml bottles can be engraved. Not sure of their taste? A discovery set of five lets them choose.`,
    chip: "Gifts",
    matches: all,
  },
  {
    slug: "gifts-for-her",
    title: "Perfume Gift Set for Her | Australia | Maison Obsidian",
    description: `Perfume gifts for her: extrait-strength fragrances from ${money(HOUSE_PRICE.ml10)}, hand-poured in Brisbane. Build a discovery gift set of five or give a 50 ml, engraved.`,
    eyebrow: "Gifts for her",
    h1: "Perfume gifts for her.",
    intro: `Perfume gift sets for her — florals, vanillas, roses and ambers at extrait strength, hand-poured in Brisbane. Give a 50 ml for ${money(HOUSE_PRICE.ml50)}, or a discovery set of five to explore.`,
    chip: "For her",
    matches: (f) => f.gender === "feminine" || f.gender === "unisex",
  },
  {
    slug: "gifts-for-him",
    title: "Men's Fragrance Gift | Australia | Maison Obsidian",
    description: `Men's fragrance gifts: woody, oud, leather and fresh extrait-strength scents, hand-poured in Brisbane. A 50 ml for ${money(HOUSE_PRICE.ml50)}, or pair it with a car diffuser.`,
    eyebrow: "Gifts for him",
    h1: "Men's fragrance gifts.",
    intro: `Men's fragrance gifts — woods, oud, leather and fresh citrus at extrait strength, hand-poured in Brisbane. Give a 50 ml for ${money(HOUSE_PRICE.ml50)}, and add the same scent as a car diffuser for ${money(HOUSE_PRICE.car)}.`,
    chip: "For him",
    matches: (f) => f.gender === "masculine" || f.gender === "unisex",
  },
];

export const LANDING_BY_SLUG: Record<string, Landing> = Object.fromEntries(LANDINGS.map((l) => [l.slug, l]));

/** The landing page paths, for the prerender and sitemap. */
export const LANDING_PATHS = LANDINGS.map((l) => `/shop/${l.slug}`);
