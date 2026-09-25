// Google Analytics 4. Off unless VITE_GA_MEASUREMENT_ID is set (e.g.
// G-ABC123XYZ), so local development and previews send nothing unless asked.
//
// The storefront is a single-page app: GA's automatic page view would only
// fire once, so page views are sent here on every route change instead. The
// admin, staff and account screens are not tracked, and query strings are
// dropped (the thank-you page's Stripe session id never leaves the browser).
//
// Ecommerce events use GA4's recommended names so the Monetisation reports
// fill in: view_item, add_to_cart, begin_checkout, purchase. Money is sent in
// dollars (the app works in cents).

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

let lastPath = "";
function pageView(): void {
  const path = window.location.pathname;
  if (PRIVATE.test(path) || path === lastPath) return;
  lastPath = path;
  // After the new screen has rendered and set its own title (usePageMeta).
  setTimeout(() => {
    gtag("event", "page_view", {
      page_location: window.location.origin + path,
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
