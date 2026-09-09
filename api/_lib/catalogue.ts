// Pricing rules for the server routes — a self-contained mirror of the parts
// of src/lib/formats.ts that Checkout needs. The api folder runs on Vercel as
// plain ES modules without a bundler, so it cannot import the storefront's
// modules (they resolve extensionless paths through Vite). Keep the two in
// step: the route test compares them against the seed catalogue.

export type FormatKey = "perf10" | "perf30" | "perf50" | "car" | "wash" | "moist" | "ritual";
export type FormatStatus = "live" | "coming_soon" | "hidden";

/** The slice of a fragrance the pricing rules read. */
export interface CatalogueItem {
  id: string;
  slug: string;
  name: string;
  price: number; // 50 ml, cents
  price10: number;
  price30: number;
  vipOnly: boolean;
  stock10: number;
  stock30: number;
  stock50: number;
  stockCar: number;
  stockWash: number;
  stockMoist: number;
  formatPrices?: Partial<Record<FormatKey, number>>;
  formatStatus?: Partial<Record<FormatKey, FormatStatus>>;
}

export interface FormatDef {
  key: FormatKey;
  group: "wear" | "drive" | "live" | "ritual";
  name: string;
  sizeMl: number;
  defaultPrice: number | null;
  defaultStatus: FormatStatus;
}

export const FORMATS: FormatDef[] = [
  { key: "perf10", group: "wear", name: "Eau de Parfum 10ml", sizeMl: 10, defaultPrice: null, defaultStatus: "live" },
  { key: "perf30", group: "wear", name: "Eau de Parfum 30ml", sizeMl: 30, defaultPrice: null, defaultStatus: "live" },
  { key: "perf50", group: "wear", name: "Eau de Parfum 50ml", sizeMl: 50, defaultPrice: null, defaultStatus: "live" },
  { key: "car", group: "drive", name: "Car Diffuser 10ml", sizeMl: 10, defaultPrice: 1000, defaultStatus: "live" },
  { key: "wash", group: "live", name: "Body Wash 300ml", sizeMl: 300, defaultPrice: 4200, defaultStatus: "coming_soon" },
  { key: "moist", group: "live", name: "Body Moisturiser 300ml", sizeMl: 300, defaultPrice: 4800, defaultStatus: "coming_soon" },
  { key: "ritual", group: "ritual", name: "The Complete Ritual (4 pieces)", sizeMl: 50, defaultPrice: null, defaultStatus: "coming_soon" },
];
export const FORMAT_BY_KEY = Object.fromEntries(FORMATS.map((f) => [f.key, f])) as Record<FormatKey, FormatDef>;

const RITUAL_PARTS: FormatKey[] = ["perf50", "wash", "moist"];
const RITUAL_DISCOUNT = 0.15;

export const SUBSCRIPTION_MONTHS = 12;
export const SUBSCRIPTION_DISCOUNT = 0.1;
export const DISCOVERY_BOX_SIZE = 5;
export const DISCOVERY_BOX_PRICE = 5000; // cents — five 10 ml discoveries

export function formatPrice(f: CatalogueItem, key: FormatKey): number {
  const override = f.formatPrices?.[key];
  if (override != null && override > 0) return override;
  switch (key) {
    case "perf10":
      return f.price10;
    case "perf30":
      return f.price30;
    case "perf50":
      return f.price;
    case "ritual":
      return Math.round((RITUAL_PARTS.reduce((s, k) => s + formatPrice(f, k), 0) * (1 - RITUAL_DISCOUNT)) / 100) * 100;
    default:
      return FORMAT_BY_KEY[key].defaultPrice ?? 0;
  }
}

export function formatStatus(f: CatalogueItem, key: FormatKey): FormatStatus {
  const own = f.formatStatus?.[key] ?? FORMAT_BY_KEY[key].defaultStatus;
  if (key !== "ritual") return own;
  const parts = RITUAL_PARTS.map((k) => formatStatus(f, k));
  if (parts.includes("hidden")) return "hidden";
  if (parts.includes("coming_soon")) return own === "hidden" ? "hidden" : "coming_soon";
  return own;
}

function rawStock(f: CatalogueItem, key: FormatKey): number {
  switch (key) {
    case "perf10":
      return f.stock10;
    case "perf30":
      return f.stock30;
    case "perf50":
      return f.stock50;
    case "car":
      return f.stockCar;
    case "wash":
      return f.stockWash;
    case "moist":
      return f.stockMoist;
    case "ritual":
      return Math.min(...RITUAL_PARTS.map((k) => rawStock(f, k)));
  }
}

/** Purchasable now: live and stocked, or a made-to-order perfume / diffuser. */
export function buyable(f: CatalogueItem, key: FormatKey): boolean {
  const def = FORMAT_BY_KEY[key];
  const perfume = def.group === "wear" || def.group === "drive";
  return formatStatus(f, key) === "live" && (rawStock(f, key) > 0 || perfume);
}

/** Member price for one month: 10% under the format's shelf price. */
export function subscriptionPrice(f: CatalogueItem, key: FormatKey): number {
  return Math.round(formatPrice(f, key) * (1 - SUBSCRIPTION_DISCOUNT));
}
