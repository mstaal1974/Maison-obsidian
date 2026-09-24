// Shop by house. Most shoppers arrive knowing the original they love
// ("Tom Ford — Black Lacquer"), so the catalogue is also browsable as
// house → original scent → its Obsidian. Houses come from each fragrance's
// inspiration line (referenceOf), grouped case- and punctuation-insensitively.
import type { Fragrance } from "./data";
import { referenceOf } from "./formats";

export interface HouseScent {
  /** The original it is built on, e.g. "Black Lacquer" ("" when unnamed). */
  original: string;
  frag: Fragrance;
}

export interface House {
  key: string;
  name: string;
  scents: HouseScent[];
}

const squash = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/** Houses A–Z, each with its scents A–Z by original name. */
export function housesOf(frags: Fragrance[]): House[] {
  const by = new Map<string, House>();
  for (const frag of frags) {
    const { brand, fragrance } = referenceOf(frag);
    if (!brand) continue;
    const key = squash(brand);
    if (!key) continue;
    const house = by.get(key) ?? { key, name: brand, scents: [] };
    house.scents.push({ original: fragrance, frag });
    by.set(key, house);
  }
  const houses = [...by.values()];
  for (const h of houses) h.scents.sort((a, b) => (a.original || a.frag.name).localeCompare(b.original || b.frag.name));
  return houses.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Narrow the houses to a search: a house whose name matches keeps all its
 * scents; otherwise only the scents whose original (or Obsidian name) matches.
 */
export function searchHouses(houses: House[], query: string): House[] {
  const parts = query.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  if (!parts.length) return houses;
  const hit = (s: string) => parts.every((p) => squash(s).includes(p));
  const out: House[] = [];
  for (const h of houses) {
    if (hit(h.name)) {
      out.push(h);
      continue;
    }
    const scents = h.scents.filter((s) => hit(`${h.name} ${s.original}`) || hit(s.frag.name));
    if (scents.length) out.push({ ...h, scents });
  }
  return out;
}
