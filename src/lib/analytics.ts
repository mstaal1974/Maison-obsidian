// Google Analytics 4. Off unless VITE_GA_MEASUREMENT_ID is set (e.g.
// G-ABC123XYZ), so local development and previews send nothing unless asked.
//
// The storefront is a single-page app: GA's automatic page view would only
// fire once, so page views are sent here on every route change instead. The
// admin, staff and account screens are not tracked, and query strings are
// dropped (the thank-you page's Stripe session id never leaves the browser)
// except campaign tags — utm_* and ad click ids — which GA reads from the page
// location to attribute the visit to the post, creative or ad that sent it.
//
// Ecommerce events use GA4's recommended names so the Monetisation reports
// fill in: view_item, select_item, add_to_cart, begin_checkout, purchase.
// Money is sent in dollars (the app works in cents). The funnel between them
// uses GA4's names too: view_item_list, search, view_cart, remove_from_cart,
// add_shipping_info and add_payment_info. Events of the house's own:
// discovery_box_completed, scent_match_completed, car_diffuser_attach,
// quiz_start, quiz_step, quiz_complete, format_selected,
// subscription_offer_viewed and subscription_started — none carries quiz
// answers, search text beyond the query itself, or anything personal.

import type { FormatKey } from "./data";
import { onRouteChange } from "./route";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? "").trim();
const enabled = /^G-[A-Z0-9]+$/.test(ID);
const CURRENCY = "AUD";
const PRIVATE = /^\/(admin|staff|account|reset)(\/|$)/;

function gtag(...args: unknown[]): void {
  if (enabled) window.gtag?.(...args);
}

const CAMPAIGN = /^(utm_(source|medium|campaign|content|term|id)|gclid|gbraid|wbraid|fbclid|ttclid)$/;

/** The query string cut down to campaign tags, e.g. "?utm_source=instagram". */
function campaignQuery(): string {
  const kept = new URLSearchParams();
  new URLSearchParams(window.location.search).forEach((v, k) => {
    if (CAMPAIGN.test(k)) kept.append(k, v);
  });
  const q = kept.toString();
  return q ? `?${q}` : "";
}

let lastPath = "";
function pageView(): void {
  const path = window.location.pathname;
  if (PRIVATE.test(path) || path === lastPath) return;
  lastPath = path;
  const query = campaignQuery();
  // After the new screen has rendered and set its own title (usePageMeta).
  setTimeout(() => {
    gtag("event", "page_view", {
      page_location: window.location.origin + path + query,
      page_path: path,
      page_title: document.title,
    });
  }, 60);
}

/** Loads gtag.js and starts page tracking. Call once, before the app renders. */
export function initAnalytics(): void {
  if (!enabled || typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  // gtag.js reads the arguments object itself, not an array.
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", ID, { send_page_view: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID)}`;
  document.head.appendChild(s);
  pageView();
  onRouteChange(pageView);
}

export interface AnalyticsItem {
  id: string;
  name?: string;
  format?: FormatKey;
  /** Unit price in cents. */
  priceCents?: number;
  qty?: number;
}

const items = (list: AnalyticsItem[]) =>
  list.map((i) => ({
    item_id: i.id,
    ...(i.name ? { item_name: i.name } : {}),
    ...(i.format ? { item_variant: i.format } : {}),
    ...(i.priceCents != null ? { price: i.priceCents / 100 } : {}),
    quantity: i.qty ?? 1,
  }));
const value = (list: AnalyticsItem[]) => list.reduce((n, i) => n + (i.priceCents ?? 0) * (i.qty ?? 1), 0) / 100;

export function trackViewItem(item: AnalyticsItem): void {
  gtag("event", "view_item", { currency: CURRENCY, value: value([item]), items: items([item]) });
}

/** A product opened from a listing (a card in a collection, related scents …). */
export function trackSelectItem(item: AnalyticsItem, list?: string): void {
  gtag("event", "select_item", { ...(list ? { item_list_name: list } : {}), items: items([item]) });
}

/** A full Discovery Box went into the bag. */
export function trackDiscoveryBoxCompleted(list: AnalyticsItem[]): void {
  gtag("event", "discovery_box_completed", { currency: CURRENCY, value: value(list), items: items(list) });
}

/** A Scent DNA result was revealed. Only how they got there, never the answers. */
export function trackScentMatchCompleted(method: string): void {
  gtag("event", "scent_match_completed", { method });
}

/** A car diffuser went into a bag that already holds a perfume. */
export function trackCarDiffuserAttach(item: AnalyticsItem): void {
  gtag("event", "car_diffuser_attach", { currency: CURRENCY, value: value([item]), items: items([item]) });
}

export function trackAddToCart(item: AnalyticsItem): void {
  gtag("event", "add_to_cart", { currency: CURRENCY, value: value([item]), items: items([item]) });
}

export function trackBeginCheckout(list: AnalyticsItem[]): void {
  gtag("event", "begin_checkout", { currency: CURRENCY, value: value(list), items: items(list) });
}

/** One per paid order; GA ignores a repeat of the same transaction id. */
export function trackPurchase(transactionId: string, totalCents: number, list: AnalyticsItem[]): void {
  gtag("event", "purchase", { transaction_id: transactionId, currency: CURRENCY, value: totalCents / 100, items: items(list) });
}

/** A listing was shown: a collection, search results, "Where to start" … */
export function trackViewItemList(list: string, shown: AnalyticsItem[]): void {
  gtag("event", "view_item_list", { item_list_name: list, items: items(shown.slice(0, 20)) });
}

/** A catalogue search. `kind` separates our own scents from "inspired by" matches. */
export function trackSearch(term: string, kind: "catalogue" | "match", results: number): void {
  const t = term.trim().slice(0, 80);
  if (t) gtag("event", "search", { search_term: t, search_kind: kind, results });
}

export function trackViewCart(list: AnalyticsItem[]): void {
  gtag("event", "view_cart", { currency: CURRENCY, value: value(list), items: items(list) });
}

export function trackRemoveFromCart(item: AnalyticsItem): void {
  gtag("event", "remove_from_cart", { currency: CURRENCY, value: value([item]), items: items([item]) });
}

/** Delivery chosen at checkout: "pickup", or a carrier/service name. */
export function trackAddShippingInfo(list: AnalyticsItem[], tier: string): void {
  gtag("event", "add_shipping_info", { currency: CURRENCY, value: value(list), shipping_tier: tier, items: items(list) });
}

/** Details complete, handing over to Stripe for payment. */
export function trackAddPaymentInfo(list: AnalyticsItem[]): void {
  gtag("event", "add_payment_info", { currency: CURRENCY, value: value(list), payment_type: "card", items: items(list) });
}

export function trackQuizStart(quiz: string): void {
  gtag("event", "quiz_start", { quiz });
}

/** Step reached, by number only — never the answer given. */
export function trackQuizStep(quiz: string, step: number): void {
  gtag("event", "quiz_step", { quiz, step });
}

export function trackQuizComplete(quiz: string): void {
  gtag("event", "quiz_complete", { quiz });
}

/** A size or format chosen on a product page or in quick view. */
export function trackFormatSelected(item: AnalyticsItem, where: string): void {
  gtag("event", "format_selected", { where, items: items([item]) });
}

export function trackSubscriptionOfferViewed(where: string): void {
  gtag("event", "subscription_offer_viewed", { where });
}

/** A Monthly Pour confirmed as paid on return from Stripe. */
export function trackSubscriptionStarted(sessionId: string): void {
  gtag("event", "subscription_started", { transaction_id: sessionId });
}
