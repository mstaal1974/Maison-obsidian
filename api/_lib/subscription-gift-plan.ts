// Prepaid Monthly Pour rates in AUD cents, including Australian delivery.
// The same price table is used by the shop and the Stripe checkout route.
export const GIFT_FORMATS = {
  perf10: { label: "10 ml eau de parfum", monthlyCents: 1080 },
  perf30: { label: "30 ml eau de parfum", monthlyCents: 2700 },
  perf50: { label: "50 ml eau de parfum", monthlyCents: 3600 },
  car: { label: "10 ml car diffuser", monthlyCents: 900 },
} as const;

export const GIFT_TERMS = [3, 6, 12] as const;
export type GiftFormat = keyof typeof GIFT_FORMATS;
export type GiftTerm = typeof GIFT_TERMS[number];
export type SubscriptionGiftPlan = { format: GiftFormat; months: GiftTerm };
export const GIFT_PATH = "/subscription-gift";
export const GIFT_CODE_PATTERN = /^MP-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/;

export function giftPlan(format: unknown, months: unknown): SubscriptionGiftPlan | null {
  if (typeof format !== "string" || !Object.prototype.hasOwnProperty.call(GIFT_FORMATS, format)) return null;
  const term = GIFT_TERMS.find((option) => option === Number(months));
  return term ? { format: format as GiftFormat, months: term } : null;
}

export function giftTotal({ format, months }: SubscriptionGiftPlan): number {
  return GIFT_FORMATS[format].monthlyCents * months;
}

export function giftDescription({ format, months }: SubscriptionGiftPlan): string {
  return `${months} months of ${GIFT_FORMATS[format].label}`;
}

export function giftClaimPath(code?: string): string {
  return `${GIFT_PATH}?redeem=1${code ? `#${encodeURIComponent(code)}` : ""}`;
}
