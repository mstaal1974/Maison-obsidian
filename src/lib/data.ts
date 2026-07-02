// ─── Domain: Maison Obsidian batch-atelier catalogue ─────────────────────────

export type Gender = "masculine" | "feminine" | "unisex";

export interface Fragrance {
  id: string;
  slug: string;
  name: string;
  inspiration: string;
  tagline: string;
  story: string;
  price: number; // cents
  gender: Gender;
  moq: number;
  committed: number;
  liquid: string; // hex
  accent: string; // hex
  vipOnly?: boolean;
  top: string[];
  heart: string[];
  base: string[];
}

export const FRAGS: Fragrance[] = [
  {
    id: "f1",
    slug: "obsidian-no-1",
    name: "Obsidian No. 1",
    inspiration: "Inspired by Aventus",
    tagline: "Smoked pineapple, birch, ambergris.",
    story:
      "A signature opening of Sicilian pineapple charred over Laotian oud smoke. Birch tar and rose absolute settle into a base of ambergris and oakmoss. Bold, executive, unmistakable.",
    price: 18500,
    gender: "masculine",
    moq: 20,
    committed: 12,
    liquid: "#3b2a18",
    accent: "#c9a961",
    top: ["Pineapple", "Bergamot", "Black Currant"],
    heart: ["Birch Tar", "Rose Absolute", "Patchouli"],
    base: ["Ambergris", "Oakmoss", "Vanilla"],
  },
  {
    id: "f2",
    slug: "noir-imperial",
    name: "Noir Impérial",
    inspiration: "Inspired by Tobacco Vanille",
    tagline: "Pipe tobacco, cocoa, dried fig.",
    story:
      "An aged tobacco leaf wrapped in vanilla orchid and Madagascan cocoa. Dried fig and tonka bean linger like the embers of a private library long after midnight.",
    price: 19500,
    gender: "unisex",
    moq: 25,
    committed: 19,
    liquid: "#5a3514",
    accent: "#c9a961",
    top: ["Spicy Tobacco", "Cardamom"],
    heart: ["Tonka Bean", "Cocoa", "Dried Fig"],
    base: ["Vanilla Orchid", "Sandalwood"],
  },
  {
    id: "f3",
    slug: "saffron-vellum",
    name: "Saffron Vellum",
    inspiration: "Inspired by Baccarat Rouge 540",
    tagline: "Saffron, jasmine, ambered woods.",
    story:
      "Persian saffron threads steeped in jasmine sambac, suspended over a glowing base of cedar and ambergris. A scent that signs the air around you in gold leaf.",
    price: 21500,
    gender: "unisex",
    moq: 30,
    committed: 30,
    liquid: "#a04a1c",
    accent: "#d9b370",
    top: ["Saffron"],
    heart: ["Jasmine Sambac", "Egyptian Jasmine"],
    base: ["Ambergris", "Cedar", "Fir Resin"],
  },
  {
    id: "f4",
    slug: "atelier-rose",
    name: "Atelier Rose",
    inspiration: "Inspired by Roses on Ice",
    tagline: "Taif rose, lychee, frozen oud.",
    story:
      "A glacial bouquet of Taif rose laid over chilled lychee and a whisper of Hindi oud. Romantic without being sweet — the floral equivalent of a black silk dress.",
    price: 19000,
    gender: "feminine",
    moq: 20,
    committed: 7,
    vipOnly: true,
    liquid: "#9c4660",
    accent: "#e0b884",
    top: ["Lychee", "Pink Pepper"],
    heart: ["Taif Rose", "Bulgarian Rose"],
    base: ["White Oud", "White Musk"],
  },
  {
    id: "f5",
    slug: "khaleeji-oud",
    name: "Khaleeji Oud",
    inspiration: "Inspired by Oud for Greatness",
    tagline: "Lavender, oud, saffron smoke.",
    story:
      "A diplomat's signature. Bright lavender folds into smoked saffron and a column of Cambodian oud, anchored with patchouli that lingers on cashmere for days.",
    price: 22500,
    gender: "masculine",
    moq: 25,
    committed: 22,
    liquid: "#2c1a0c",
    accent: "#c9a961",
    top: ["Lavender", "Nutmeg"],
    heart: ["Saffron", "Cambodian Oud"],
    base: ["Patchouli", "Musk"],
  },
  {
    id: "f6",
    slug: "bleu-marbre",
    name: "Bleu Marbre",
    inspiration: "Inspired by Bleu de Chanel",
    tagline: "Citron, ginger, sandalwood.",
    story:
      "Mediterranean citron and pink pepper rise off icy ginger; a heart of nutmeg leads into sandalwood, cedar and a column of clean white musk. Effortless, year round.",
    price: 17500,
    gender: "masculine",
    moq: 20,
    committed: 5,
    liquid: "#1f3a5e",
    accent: "#c9a961",
    top: ["Citron", "Pink Pepper", "Ginger"],
    heart: ["Nutmeg", "Jasmine"],
    base: ["Sandalwood", "Cedar", "White Musk"],
  },
  {
    id: "f7",
    slug: "velours-iris",
    name: "Velours d'Iris",
    inspiration: "Inspired by La Vie est Belle",
    tagline: "Iris pallida, suede, vanilla orchid.",
    story:
      "Powdered Tuscan iris draped over honeyed suede, with pear blossom and orange flower lifting the heart. The base is a soft hum of vanilla orchid, tonka and praline.",
    price: 18500,
    gender: "feminine",
    moq: 20,
    committed: 11,
    liquid: "#b8627c",
    accent: "#e3bf7a",
    top: ["Pear Blossom", "Black Currant"],
    heart: ["Iris Pallida", "Orange Flower", "Suede Accord"],
    base: ["Vanilla Orchid", "Tonka Bean", "Praline"],
  },
  {
    id: "f8",
    slug: "tubereuse-blanche",
    name: "Tubéreuse Blanche",
    inspiration: "Inspired by Good Girl",
    tagline: "Tuberose, almond, cocoa noir.",
    story:
      "A heady stem of Indian tuberose snapped fresh, laid over salted almond and cocoa noir. Sambac jasmine fills the room; sandalwood and tonka leave the door behind you long after.",
    price: 19500,
    gender: "feminine",
    moq: 22,
    committed: 8,
    liquid: "#5b3b86",
    accent: "#d6b66f",
    top: ["Almond", "Lemon", "Coffee"],
    heart: ["Tuberose", "Jasmine Sambac", "Cocoa Noir"],
    base: ["Tonka Bean", "Sandalwood", "White Musk"],
  },
  {
    id: "f9",
    slug: "sauvage-onyx",
    name: "Sauvage Onyx",
    inspiration: "Inspired by Sauvage Elixir",
    tagline: "Liquorice, grapefruit, cinnamon.",
    story:
      "An icy snap of Calabrian bergamot meets liquorice and grapefruit zest; cinnamon and nutmeg warm a heart of lavender absolute over patchouli, vetiver and amber.",
    price: 19500,
    gender: "masculine",
    moq: 25,
    committed: 17,
    liquid: "#13344f",
    accent: "#c9a961",
    top: ["Calabrian Bergamot", "Grapefruit", "Liquorice"],
    heart: ["Cinnamon", "Nutmeg", "Lavender Absolute"],
    base: ["Patchouli", "Vetiver", "Amber"],
  },
];

// ─── Design tokens ───────────────────────────────────────────────────────────
export const GOLD = "#c9a961";
export const CREAM = "#f3ecdc";
export const OBSIDIAN = "#0b0b0d";
export const HAIRLINE = "#1f1f27";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Lighten (p > 0) or darken (p < 0) a #rrggbb hex toward white/black. */
export function shade(hex: string, p: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const t = p < 0 ? 0 : 255;
  const a = Math.abs(p);
  r = Math.round(r + (t - r) * a);
  g = Math.round(g + (t - g) * a);
  b = Math.round(b + (t - b) * a);
  return `rgb(${r},${g},${b})`;
}

export function money(cents: number): string {
  return "$" + Math.round(cents / 100);
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export type Filter = "all" | "men" | "women";

export function matches(f: Fragrance, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "men") return f.gender === "masculine" || f.gender === "unisex";
  return f.gender === "feminine" || f.gender === "unisex";
}
