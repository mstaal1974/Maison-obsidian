// Hash router for the storefront. Every page is a hash so the app stays a
// single static bundle on Vercel and the Supabase auth redirect keeps working.

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
  | { view: "account"; checkout: "success" | null; subscribed: boolean; sessionId: string | null }
  | { view: "admin" }
  // The staff order desk: packing, tracking, labels. Its own page, reachable at
  // /staff as well as the hash form, and behind its own passphrase.
  | { view: "staff" };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, "");
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

/**
 * The route for a clean path, so a link pasted from Instagram or printed on a
 * QR code (maisonobsidian.com.au/discover) opens the right screen. Vercel
 * rewrites these paths to the app; anything else falls back to the storefront.
 */
export function parsePath(pathname: string): Route {
  const segments = pathname.replace(/^\/+|\/+$/g, "").split("/");
  const [head, ...rest] = segments;
  switch (head) {
    case "discover":
    case "scent-dna":
      return { view: "scent", code: null };
    case "scent":
      return { view: "scent", code: rest[0] ? decodeURIComponent(rest[0]) : null };
    case "staff":
      return { view: "staff" };
    default:
      return { view: "home" };
  }
}

/**
 * The current route: the hash whenever there is one — even "#/" — so navigating
 * home from /discover lands on the storefront instead of bouncing back to the
 * campaign page. The clean path is only read on a cold open.
 */
export function currentRoute(): Route {
  return window.location.hash ? parseHash(window.location.hash) : parsePath(window.location.pathname);
}

export function navigate(to: string, scrollTop = true): void {
  window.location.hash = to;
  if (scrollTop) window.scrollTo({ top: 0, behavior: "smooth" });
}

export const paths = {
  home: "#/",
  shop: (facet?: string) => (facet ? `#/shop/${encodeURIComponent(facet)}` : "#/shop"),
  fragrances: "#/fragrances",
  discovery: "#/discovery",
  car: "#/car",
  body: "#/body",
  find: (q?: string) => (q ? `#/find?q=${encodeURIComponent(q)}` : "#/find"),
  discover: "#/discover",
  scent: (code: string) => `#/scent/${encodeURIComponent(code)}`,
  product: (slug: string) => `#/fragrance/${encodeURIComponent(slug)}`,
  subscribe: (slug?: string, format?: string) => {
    const q = new URLSearchParams();
    if (slug) q.set("f", slug);
    if (format) q.set("format", format);
    const qs = q.toString();
    return qs ? `#/subscribe?${qs}` : "#/subscribe";
  },
  checkout: "#/checkout",
  thanks: "#/thanks",
  about: "#/about",
  account: "#/account",
  admin: "#/admin",
  staff: "#/staff",
};
