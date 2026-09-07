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
  | { view: "product"; slug: string }
  | { view: "about" }
  | { view: "account" }
  | { view: "admin" };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, "");
  const [head, ...rest] = h.split("/");
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
    case "fragrance":
      return tail ? { view: "product", slug: decodeURIComponent(tail) } : { view: "fragrances" };
    case "about":
      return { view: "about" };
    case "account":
      return { view: "account" };
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
  about: "#/about",
  account: "#/account",
  admin: "#/admin",
};
