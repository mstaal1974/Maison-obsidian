// Path router for the storefront. Every page has a real URL
// (/fragrance/smoky-timber, /shop/woody) so search engines can index it and a
// shared link previews the right page; Vercel serves the app for any path
// that isn't a file (vercel.json), and scripts/prerender.mjs writes a page per
// fragrance with its own title and social card.
//
// The site used to route on the hash (#/fragrance/…). Those links still work:
// migrateLegacyHash() rewrites them to the path form on load. A hash that
// doesn't start with "#/" (Supabase's #access_token=… after sign-in) is left
// alone for the auth client to read.

export type Route =
  | { view: "home" }
  | { view: "shop"; facet: string | null } // #/shop, #/shop/him, #/shop/woody, #/shop/50ml
  | { view: "fragrances" }
  | { view: "discovery" }
  | { view: "car" }
  | { view: "body" }
  | { view: "find"; query: string }
  // Discover Your Scent DNA — a standalone campaign experience. Reachable at
  // /discover and /scent-dna (clean paths, rewritten to the app) as well as the
  // hash form, and /scent/<code> opens a shared Scentprint.
  | { view: "scent"; code: string | null }
  | { view: "subscribe"; slug: string | null; format: string | null }
  | { view: "checkout"; cancelled: boolean }
  | { view: "thanks"; sessionId: string | null }
  | { view: "product"; slug: string }
  | { view: "about" }
  | { view: "help" }
  | { view: "account"; checkout: "success" | null; subscribed: boolean; sessionId: string | null }
  | { view: "admin" }
  // The staff order desk: packing, tracking, labels. Its own page, reachable at
  // /staff as well as the hash form, and behind its own passphrase.
  | { view: "staff" };

/** The route for "#/fragrance/x?y" (legacy) or "/fragrance/x?y". */
export function parseHash(hash: string): Route {
  const h = hash.replace(/^#?\/?/, "");
  // Split the query string off first so "#/find?q=…" still routes to "find".
  const [head, ...rest] = h.split("?")[0].split("/");
  const tail = rest.join("/");
  switch (head) {
    case "":
      return { view: "home" };
    case "shop":
      return { view: "shop", facet: tail ? decodeURIComponent(tail) : null };
    case "fragrances":
      return { view: "fragrances" };
    case "discovery":
      return { view: "discovery" };
    case "car":
      return { view: "car" };
    case "body":
      return { view: "body" };
    case "discover":
    case "scent-dna":
      return { view: "scent", code: null };
    case "scent":
      return { view: "scent", code: tail ? decodeURIComponent(tail) : null };
    case "staff":
      return { view: "staff" };
    case "find": {
      const q = h.includes("?") ? new URLSearchParams(h.slice(h.indexOf("?") + 1)).get("q") ?? "" : "";
      return { view: "find", query: q };
    }
    case "subscribe": {
      const qs = h.includes("?") ? new URLSearchParams(h.slice(h.indexOf("?") + 1)) : null;
      return { view: "subscribe", slug: qs?.get("f") ?? null, format: qs?.get("format") ?? null };
    }
    case "checkout": {
      const qs = h.includes("?") ? new URLSearchParams(h.slice(h.indexOf("?") + 1)) : null;
      return { view: "checkout", cancelled: qs?.get("cancelled") === "1" };
    }
    case "thanks": {
      const qs = h.includes("?") ? new URLSearchParams(h.slice(h.indexOf("?") + 1)) : null;
      return { view: "thanks", sessionId: qs?.get("session_id") ?? null };
    }
    case "fragrance":
      return tail ? { view: "product", slug: decodeURIComponent(tail) } : { view: "fragrances" };
    case "help":
      return { view: "help" };
    case "about":
      return { view: "about" };
    case "account": {
      const qs = h.includes("?") ? new URLSearchParams(h.slice(h.indexOf("?") + 1)) : null;
      return { view: "account", checkout: qs?.get("checkout") === "success" ? "success" : null, subscribed: qs?.get("subscribed") === "1", sessionId: qs?.get("session_id") ?? null };
    }
    case "admin":
      return { view: "admin" };
    default:
      return { view: "home" };
  }
}

/** The current route, from the legacy hash if there is one, else the path. */
export function currentRoute(): Route {
  const { hash, pathname, search } = window.location;
  return hash.startsWith("#/") ? parseHash(hash) : parseHash(pathname + search);
}

/** Old "#/…" links (bookmarks, QR codes, checkouts in flight) become paths. */
export function migrateLegacyHash(): void {
  const { hash } = window.location;
  if (hash.startsWith("#/")) window.history.replaceState(null, "", hash.slice(1) || "/");
}

const ROUTE_EVENT = "mo:route";

/** Calls `fn` whenever the route changes: a link, navigate(), back or forward. */
export function onRouteChange(fn: () => void): () => void {
  const onHash = () => {
    // Someone typed or followed an old "#/…" URL within the page.
    if (!window.location.hash.startsWith("#/")) return;
    migrateLegacyHash();
    fn();
  };
  window.addEventListener(ROUTE_EVENT, fn);
  window.addEventListener("popstate", fn);
  window.addEventListener("hashchange", onHash);
  return () => {
    window.removeEventListener(ROUTE_EVENT, fn);
    window.removeEventListener("popstate", fn);
    window.removeEventListener("hashchange", onHash);
  };
}

export function navigate(to: string, scrollTop = true): void {
  const url = to.startsWith("#") ? to.slice(1) || "/" : to;
  if (url !== window.location.pathname + window.location.search + window.location.hash) {
    window.history.pushState(null, "", url);
    window.dispatchEvent(new Event(ROUTE_EVENT));
  }
  if (scrollTop) window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Same-origin <a href="/…"> clicks become in-app navigation instead of full
 * page loads. Modified clicks (new tab, download) and API or asset links are
 * left to the browser.
 */
export function interceptLinks(): void {
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a");
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin || /^\/(api|assets)\//.test(url.pathname)) return;
    if (url.hash.startsWith("#/")) {
      e.preventDefault();
      navigate(url.hash);
      return;
    }
    if (url.hash && url.pathname === window.location.pathname) return; // in-page anchor
    e.preventDefault();
    navigate(url.pathname + url.search);
  });
}

export const paths = {
  home: "/",
  shop: (facet?: string) => (facet ? `/shop/${encodeURIComponent(facet)}` : "/shop"),
  fragrances: "/fragrances",
  discovery: "/discovery",
  car: "/car",
  body: "/body",
  find: (q?: string) => (q ? `/find?q=${encodeURIComponent(q)}` : "/find"),
  discover: "/discover",
  scent: (code: string) => `/scent/${encodeURIComponent(code)}`,
  product: (slug: string) => `/fragrance/${encodeURIComponent(slug)}`,
  subscribe: (slug?: string, format?: string) => {
    const q = new URLSearchParams();
    if (slug) q.set("f", slug);
    if (format) q.set("format", format);
    const qs = q.toString();
    return qs ? `/subscribe?${qs}` : "/subscribe";
  },
  checkout: "/checkout",
  thanks: "/thanks",
  about: "/about",
  help: "/help",
  account: "/account",
  admin: "/admin",
  staff: "/staff",
};
