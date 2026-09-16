// GET /api/stripe/status — is checkout wired up on this deployment?
//
// Open it in a browser to see which environment variables the serverless
// functions can actually see. It reports presence and, for the Supabase keys,
// the `role` claim inside the JWT — never any key material, so it is safe to
// call without auth.

import { json, route, supabaseUrl } from "../_lib/stripe.js";

export const config = { runtime: "nodejs" };

/**
 * What a Supabase key is, for spotting one pasted into the wrong slot. The
 * legacy keys are JWTs that name themselves in a `role` claim; the newer ones
 * carry no claims and say what they are in the prefix instead. Both are in
 * circulation, and a project that has rotated has one of each.
 */
function keyKind(token: string | undefined): string | null {
  if (!token) return null;
  if (token.startsWith("sb_publishable_")) return "publishable";
  if (token.startsWith("sb_secret_")) return "secret";
  const parts = token.split(".");
  if (parts.length !== 3) return "unrecognised";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: string };
    return payload.role ?? "no-role-claim";
  } catch {
    return "unreadable";
  }
}

/** Safe to ship to a browser: the anon JWT, or the publishable key that replaced it. */
const BROWSER_SAFE = new Set(["anon", "publishable"]);
/** Must never reach a browser. */
const SERVER_ONLY = new Set(["service_role", "secret"]);

const present = (v: string | undefined) => (v ? "set" : "MISSING");

export default route("status", async function handler(req: any, res: any) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const secret = process.env.STRIPE_SECRET_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Two separate variables, and only one of them is public: VITE_ names are
  // compiled into the browser bundle. Collapsing them hides which is which,
  // and that is the difference between "replace it" and "rotate it now".
  const anonServer = process.env.SUPABASE_ANON_KEY;
  const anonBrowser = process.env.VITE_SUPABASE_ANON_KEY;
  const anon = anonServer ?? anonBrowser;
  const url = supabaseUrl();

  const env = {
    STRIPE_SECRET_KEY: secret ? `set (${secret.slice(0, 7)}…)` : "MISSING",
    STRIPE_WEBHOOK_SECRET: present(process.env.STRIPE_WEBHOOK_SECRET),
    SITE_URL: process.env.SITE_URL ?? "MISSING (falls back to the request host)",
    "SUPABASE_URL / VITE_SUPABASE_URL": url ? "set" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: serviceKey ? `set (${keyKind(serviceKey)})` : "MISSING",
    SUPABASE_ANON_KEY: anonServer ? `set (${keyKind(anonServer)})` : "MISSING",
    VITE_SUPABASE_ANON_KEY: anonBrowser ? `set (${keyKind(anonBrowser)}, public)` : "MISSING",
    // Postage is the other half of a delivered order, and its absence shows up
    // at checkout as "Postage quotes are unavailable" with nothing saying why.
    AUSPOST_PAC_KEY: present(process.env.AUSPOST_PAC_KEY),
    AUSPOST_FROM_POSTCODE: process.env.AUSPOST_FROM_POSTCODE ?? "MISSING",
  };

  // Not blocking: an order can still be placed for alternate delivery, but
  // nothing can be posted until both are set.
  const postage: string[] = [];
  if (!process.env.AUSPOST_PAC_KEY) postage.push("AUSPOST_PAC_KEY");
  if (!process.env.AUSPOST_FROM_POSTCODE) postage.push("AUSPOST_FROM_POSTCODE");

  const blocking: string[] = [];
  if (!secret) blocking.push("STRIPE_SECRET_KEY");
  if (!url) blocking.push("SUPABASE_URL (or VITE_SUPABASE_URL)");
  if (!serviceKey) blocking.push("SUPABASE_SERVICE_ROLE_KEY");
  // Needed to read the catalogue and to identify the signed-in customer;
  // without it checkout gets past the config check and then fails at sign-in.
  if (!anon) blocking.push("SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)");
  // Flag the mistake that matters — a browser key doing a server's job, or a
  // secret sitting in the variable that gets compiled into the bundle — rather
  // than anything that merely fails to look like a JWT, which is now normal.
  const serviceKind = keyKind(serviceKey);
  if (serviceKey && BROWSER_SAFE.has(serviceKind ?? "")) {
    blocking.push(`SUPABASE_SERVICE_ROLE_KEY holds a ${serviceKind} key — it must be the service_role or sb_secret_ key`);
  }
  const browserKind = keyKind(anonBrowser);
  if (anonBrowser && SERVER_ONLY.has(browserKind ?? "")) {
    blocking.push(`VITE_SUPABASE_ANON_KEY holds a ${browserKind} key — this one is compiled into the browser bundle, so it is already public. Rotate it in Supabase, then set the anon or publishable key here.`);
  }
  const serverKind = keyKind(anonServer);
  if (anonServer && SERVER_ONLY.has(serverKind ?? "")) {
    blocking.push(`SUPABASE_ANON_KEY holds a ${serverKind} key — not public, but the functions use it to identify a signed-in customer and that should run with anon privileges, not past RLS. Replace it with the anon or publishable key.`);
  }

  return json(res, 200, {
    checkoutReady: blocking.length === 0,
    blocking,
    postageReady: postage.length === 0,
    postageBlocking: postage,
    env,
    note: blocking.length === 0 ? "Checkout should work. If it still fails, the error is from Stripe itself." : "Set these in Vercel → Settings → Environment Variables (Production), then redeploy.",
  });
});
