// First-party site analytics: the data behind admin → Analytics (funnel,
// pages, journeys, click and scroll heatmaps). Stored in the house's own
// Supabase through log_site_events() — supabase/migrations/0036_site_analytics.sql
// says what is and isn't kept.
//
// Off when Supabase isn't configured, when VITE_SITE_ANALYTICS=off, inside
// the admin's heatmap preview (an iframe), when the browser sends Global
// Privacy Control, and in a browser the admin has excluded. Admin, staff,
// account and reset pages are never recorded. Nothing typed is ever read: a
// click records where it landed and the clicked control's own label.

import { onRouteChange } from "./route";

const URL_ = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
const KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "");
const PRIVATE = /^\/(admin|staff|account|reset)(\/|$)/;
const IDLE_MS = 30 * 60 * 1000;
export const NO_TRACK_KEY = "mo:no-track";

type Ev = Record<string, unknown>;
const queue: Ev[] = [];
let on = false;
let visitor = "";
let session = "";
let firstPage = true;
let page = "";
let depth = 0;

function store(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

const newId = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`).toLowerCase();

/** This browser opted out from the admin tab. */
export function isExcluded(): boolean {
  return store("local")?.getItem(NO_TRACK_KEY) === "1";
}
export function setExcluded(excluded: boolean): void {
  const s = store("local");
  if (excluded) s?.setItem(NO_TRACK_KEY, "1");
  else s?.removeItem(NO_TRACK_KEY);
}

function device(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w <= 720 ? "mobile" : w <= 1100 ? "tablet" : "desktop";
}

/** The visit: a new one after 30 minutes without activity. */
function touchSession(): void {
  const s = store("session");
  const now = Date.now();
  const last = Number(s?.getItem("mo:visit-at") ?? 0);
  session = s?.getItem("mo:visit") ?? "";
  if (!session || now - last > IDLE_MS) {
    session = newId();
    firstPage = true;
    s?.setItem("mo:visit", session);
  }
  s?.setItem("mo:visit-at", String(now));
}

function push(e: Ev): void {
  if (!on || PRIVATE.test(window.location.pathname)) return;
  touchSession();
  queue.push({ visitor, session, path: window.location.pathname.slice(0, 200), device: device(), ...e });
  if (queue.length >= 20) flush();
}

function flush(leaving = false): void {
  if (!queue.length) return;
  const batch = queue.splice(0, 40);
  void fetch(`${URL_}/rest/v1/rpc/log_site_events`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_events: batch }),
    keepalive: leaving,
  }).catch(() => undefined);
  if (queue.length) flush(leaving);
}

/**
 * The deepest point of the current page reached so far, sent as it's left —
 * and when the tab is hidden, since phones may never send pagehide. The
 * reports take each visit's deepest reading per page, so a repeat is harmless.
 */
function sendDepth(): void {
  if (page && depth > 0) queue.push({ visitor, session, path: page, device: device(), kind: "scroll", depth: Math.round(depth) });
}
function endPage(): void {
  sendDepth();
  depth = 0;
}

function onPage(): void {
  const path = window.location.pathname;
  if (path === page) return;
  endPage();
  page = PRIVATE.test(path) ? "" : path;
  if (!page) return;
  const first: Ev = {};
  if (firstPage) {
    firstPage = false;
    const q = new URLSearchParams(window.location.search);
    const ref = (() => {
      try {
        const host = document.referrer ? new URL(document.referrer).host : "";
        return host && host !== window.location.host ? host.replace(/^www\./, "") : "";
      } catch {
        return "";
      }
    })();
    if (ref) first.ref = ref;
    if (q.get("utm_source")) first.us = q.get("utm_source");
    if (q.get("utm_medium")) first.um = q.get("utm_medium");
    if (q.get("utm_campaign")) first.uc = q.get("utm_campaign");
    if (!first.us && (q.has("fbclid") || q.has("gclid") || q.has("ttclid"))) first.us = q.has("fbclid") ? "facebook" : q.has("gclid") ? "google" : "tiktok";
  }
  push({ kind: "page", ...first });
  // What shows without scrolling counts too, once the screen has rendered.
  window.setTimeout(() => page === path && measureScroll(), 1000);
}

function measureScroll(): void {
  const h = document.documentElement.scrollHeight;
  if (h > 0) depth = Math.max(depth, Math.min(100, ((window.scrollY + window.innerHeight) / h) * 100));
}

/** The clicked control's own visible label — never a field's contents. */
function labelOf(el: Element): string | null {
  const target = el.closest("a, button, [role='button'], [role='tab'], summary, label, select");
  if (!target) return null;
  const aria = target.getAttribute("aria-label");
  // textContent, not innerText: the words as written, not as styled (many labels are set in capitals).
  const text = aria || (target.tagName === "SELECT" ? target.getAttribute("name") : target.textContent);
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 80) : null;
}

function onClick(e: MouseEvent): void {
  const el = e.target as Element | null;
  if (!el || el.closest("input, textarea, [contenteditable='true']")) return;
  push({
    kind: "click",
    x: Math.round((e.clientX / window.innerWidth) * 1000) / 1000,
    y: Math.round(e.clientY + window.scrollY),
    h: document.documentElement.scrollHeight,
    name: labelOf(el),
  });
}

/** A shopping event, alongside GA4's: name, value and the fragrances involved. */
export function siteEvent(name: string, valueAud?: number, itemIds?: string[]): void {
  push({
    kind: "event",
    name,
    ...(valueAud != null && Number.isFinite(valueAud) ? { value: valueAud.toFixed(2) } : {}),
    ...(itemIds?.length ? { items: itemIds.slice(0, 20) } : {}),
  });
}

/** Starts recording. Call once, before the app renders. */
export function initSiteLog(): void {
  if (typeof window === "undefined" || !URL_ || !KEY) return;
  if (String(import.meta.env.VITE_SITE_ANALYTICS ?? "").toLowerCase() === "off") return;
  if (window.self !== window.top) return; // the admin's heatmap preview
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
  if (isExcluded()) return;
  on = true;
  const ls = store("local");
  visitor = ls?.getItem("mo:visitor") ?? "";
  if (!/^[a-z0-9-]{8,40}$/.test(visitor)) {
    visitor = newId();
    ls?.setItem("mo:visitor", visitor);
  }
  touchSession();
  // Registered before the app renders, so a page view is recorded ahead of the
  // events its screen fires (view_item …) and journeys read in order.
  onPage();
  onRouteChange(onPage);
  document.addEventListener("click", onClick, { capture: true, passive: true });
  window.addEventListener("scroll", measureScroll, { passive: true });
  window.setInterval(() => flush(), 5000);
  const leave = () => {
    endPage();
    page = "";
    flush(true);
  };
  window.addEventListener("pagehide", leave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      sendDepth();
      flush(true);
    } else if (!page) {
      onPage();
    }
  });
}
