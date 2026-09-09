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
  | { view: "subscribe"; slug: string | null; format: string | null }
  | { view: "product"; slug: string }
  | { view: "about" }
  | { view: "account"; checkout: "success" | null; subscribed: boolean; sessionId: string | null }
  | { view: "admin" };

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
    case "find": {
      const q = h.includes("?") ? new URLSearchParams(h.slice(h.indexOf("?") + 1)).get("q") ?? "" : "";
      return { view: "find", query: q };
    }
    case "subscribe": {
      const qs = h.includes("?") ? new URLSearchParams(h.slice(h.indexOf("?") + 1)) : null;
      return { view: "subscribe", slug: qs?.get("f") ?? null, format: qs?.get("format") ?? null };
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
  product: (slug: string) => `#/fragrance/${encodeURIComponent(slug)}`,
  subscribe: (slug?: string, format?: string) => {
    const q = new URLSearchParams();
    if (slug) q.set("f", slug);
    if (format) q.set("format", format);
    const qs = q.toString();
    return qs ? `#/subscribe?${qs}` : "#/subscribe";
  },
  about: "#/about",
  account: "#/account",
  admin: "#/admin",
};
