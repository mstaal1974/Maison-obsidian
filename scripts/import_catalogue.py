#!/usr/bin/env python3
"""Import a fragrance spreadsheet into the app seed + Supabase seed migration.

Usage:
    pip install openpyxl
    python scripts/import_catalogue.py path/to/Fragrance_upload.xlsx

Writes src/lib/data.ts and supabase/migrations/0002_seed.sql from one source so
the offline seed and the live database can never drift. Expected columns (header
on row 3): Scent Name | Inspired By | Description | Top Notes | Heart Notes |
Base Notes | 10ml Price | 30ml Price | 50ml Price.
"""
import sys
import openpyxl, re, json

SRC = sys.argv[1] if len(sys.argv) > 1 else "Fragrance_upload.xlsx"
wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb['Sheet1']
rows = [r for r in list(ws.iter_rows(values_only=True))[3:] if any(c not in (None, '') for c in r)]

# Gender assigned from the (well-known) inspiration reference, since the sheet
# omits it. 1-indexed by row. Everything else defaults to unisex.
MASC = {2, 5, 8, 9, 11, 13, 14, 15, 16, 17, 19, 20, 22, 24}
FEM = {3, 4, 6, 7}

# liquid swatch colour picked from the scent's notes (keyword → hex family).
COLOR_RULES = [
    (("oud", "agarwood", "ebony", "leather", "tobacco", "incense", "olibanum", "castoreum", "oakmoss"), "#2c1a0c", "#c9a961"),
    (("vanilla", "caramel", "tonka", "amber", "praline", "cocoa", "coffee", "honey"), "#5a3514", "#d9b370"),
    (("rose", "jasmine", "orange blossom", "tuberose", "floral", "lily", "iris", "lavender", "neroli"), "#9c4660", "#e0b884"),
    (("bergamot", "grapefruit", "lime", "lemon", "citrus", "marine", "aquatic", "apple", "pear", "mint"), "#1f3a5e", "#c9a961"),
    (("pepper", "cinnamon", "saffron", "ginger", "spice", "cumin", "pimento", "cardamom", "nutmeg"), "#a04a1c", "#d9b370"),
]
DEFAULT_LIQUID, DEFAULT_ACCENT = "#3b2a18", "#c9a961"

MOQ_CYCLE = [20, 22, 25, 30]


def clean_name(name, inspired):
    if inspired and inspired in name:
        name = name.split(inspired)[0]
    name = re.sub(r'\$\d+.*$', '', name)
    return name.strip()


def slugify(name):
    s = name.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def notes(cell):
    if not cell:
        return []
    return [n.strip() for n in str(cell).split(",") if n.strip()]


def pick_color(text):
    t = text.lower()
    for keys, liquid, accent in COLOR_RULES:
        if any(k in t for k in keys):
            return liquid, accent
    return DEFAULT_LIQUID, DEFAULT_ACCENT


frags = []
prices50 = []
for i, r in enumerate(rows):
    n = i + 1
    name = clean_name(str(r[0]), str(r[1]) if r[1] else "")
    inspired_by = str(r[1]).strip() if r[1] else ""
    story = str(r[2]).strip() if r[2] else ""
    top, heart, base = notes(r[3]), notes(r[4]), notes(r[5])
    p10, p30, p50 = int(r[6]), int(r[7]), int(r[8])
    prices50.append((p50, n))
    gender = "masculine" if n in MASC else "feminine" if n in FEM else "unisex"
    liquid, accent = pick_color(" ".join([story] + top + heart + base))
    moq = MOQ_CYCLE[i % len(MOQ_CYCLE)]
    committed = 0  # start empty; real commits drive the count (see migration 0007)
    headline = [x[0] for x in (top, heart, base) if x]
    tagline = ", ".join(headline) + "." if headline else story[:60]
    frags.append({
        "id": f"f{n}",
        "slug": slugify(name),
        "name": name,
        "inspiration": f"Inspired by {inspired_by}" if inspired_by else "",
        "tagline": tagline,
        "story": story,
        "price": p50 * 100,
        "price10": p10 * 100,
        "price30": p30 * 100,
        "gender": gender,
        "moq": moq,
        "committed": committed,
        "liquid": liquid,
        "accent": accent,
        "vipOnly": False,
        "top": top,
        "heart": heart,
        "base": base,
        "sort": n,
    })

# Mark the single most expensive scent as VIP-only so the VIP gate stays demoable.
_, vip_row = max(prices50)
frags[vip_row - 1]["vipOnly"] = True

# ── Emit src/lib/data.ts ─────────────────────────────────────────────────────
def ts_lit(f):
    parts = [
        f'    id: {json.dumps(f["id"])},',
        f'    slug: {json.dumps(f["slug"])},',
        f'    name: {json.dumps(f["name"])},',
        f'    inspiration: {json.dumps(f["inspiration"])},',
        f'    tagline: {json.dumps(f["tagline"])},',
        f'    story: {json.dumps(f["story"])},',
        f'    price: {f["price"]},',
        f'    price10: {f["price10"]},',
        f'    price30: {f["price30"]},',
        f'    gender: {json.dumps(f["gender"])},',
        f'    moq: {f["moq"]},',
        f'    committed: {f["committed"]},',
        f'    liquid: {json.dumps(f["liquid"])},',
        f'    accent: {json.dumps(f["accent"])},',
    ]
    if f["vipOnly"]:
        parts.append('    vipOnly: true,')
    parts += [
        f'    top: {json.dumps(f["top"])},',
        f'    heart: {json.dumps(f["heart"])},',
        f'    base: {json.dumps(f["base"])},',
    ]
    return "  {\n" + "\n".join(parts) + "\n  },"

header = '''// ─── Domain: Maison Obsidian batch-atelier catalogue ─────────────────────────
//
// Seed catalogue generated from the "Fragrance upload" spreadsheet. Prices are
// per size (10 / 30 / 50 ml) in cents; `price` is the 50 ml headline shown in the
// UI. Fields the sheet did not provide are documented in the README:
//   • gender  — assigned from the inspiration reference (sheet omitted it)
//   • moq / committed — demo batch defaults
//   • liquid / accent — swatch colours derived from each scent's notes
//   • vipOnly — the single most expensive scent, so the VIP gate stays demoable

export type Gender = "masculine" | "feminine" | "unisex";

export interface Fragrance {
  id: string;
  slug: string;
  name: string;
  inspiration: string;
  tagline: string;
  story: string;
  price: number; // 50 ml, cents
  price10: number; // 10 ml, cents
  price30: number; // 30 ml, cents
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
'''

footer = '''];

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
'''

with open("src/lib/data.ts", 'w') as fh:
    fh.write(header + "\n".join(ts_lit(f) for f in frags) + "\n" + footer)

# ── Emit supabase/migrations/0002_seed.sql ───────────────────────────────────
def sql_str(s):
    return "'" + s.replace("'", "''") + "'"

def sql_arr(xs):
    return "array[" + ",".join(sql_str(x) for x in xs) + "]" if xs else "array[]::text[]"

lines = []
for f in frags:
    lines.append(
        "  (" + ",".join([
            sql_str(f["id"]), sql_str(f["slug"]), sql_str(f["name"]),
            sql_str(f["inspiration"]), sql_str(f["tagline"]), sql_str(f["story"]),
            str(f["price10"]), str(f["price30"]), str(f["price"]),
            sql_str(f["gender"]), str(f["moq"]), str(f["committed"]),
            sql_str(f["liquid"]), sql_str(f["accent"]),
            "true" if f["vipOnly"] else "false",
            sql_arr(f["top"]), sql_arr(f["heart"]), sql_arr(f["base"]),
            str(f["sort"]),
        ]) + ")"
    )

seed = '''-- Maison Obsidian — seed catalogue
--
-- Generated from the "Fragrance upload" spreadsheet; mirrors src/lib/data.ts so
-- the live database and the offline seed render identically. Idempotent:
-- re-running refreshes descriptive fields but never clobbers the live
-- `committed` count (that is owned by the commits trigger).

insert into public.fragrances
  (id, slug, name, inspiration, tagline, story,
   price_10ml_cents, price_30ml_cents, price_50ml_cents,
   gender, moq, committed, liquid, accent, vip_only,
   top, heart, base, sort_order)
values
''' + ",\n".join(lines) + '''

on conflict (id) do update set
  slug             = excluded.slug,
  name             = excluded.name,
  inspiration      = excluded.inspiration,
  tagline          = excluded.tagline,
  story            = excluded.story,
  price_10ml_cents = excluded.price_10ml_cents,
  price_30ml_cents = excluded.price_30ml_cents,
  price_50ml_cents = excluded.price_50ml_cents,
  gender           = excluded.gender,
  moq              = excluded.moq,
  liquid           = excluded.liquid,
  accent           = excluded.accent,
  vip_only         = excluded.vip_only,
  top              = excluded.top,
  heart            = excluded.heart,
  base             = excluded.base,
  sort_order       = excluded.sort_order;
  -- NB: `committed` intentionally omitted — maintained live by the commits trigger.
'''

with open("supabase/migrations/0002_seed.sql", 'w') as fh:
    fh.write(seed)

print("wrote data.ts and 0002_seed.sql —", len(frags), "fragrances")
print("VIP-only:", frags[vip_row-1]["name"])
from collections import Counter
print("gender split:", Counter(f["gender"] for f in frags))
print("met batches:", [f["name"] for f in frags if f["committed"] >= f["moq"]])
