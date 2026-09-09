// GET /api/stripe/status — is Stripe wired up on this deployment?
//
// Open it in a browser to see which environment variables the serverless
// functions can actually see. It reports presence and, for the Supabase keys,
// the `role` claim inside the JWT — never any key material, so it is safe to
// call without auth.

import { json, route, supabaseUrl } from "../_lib/stripe.js";

export const config = { runtime: "nodejs" };

/** The `role` claim of a Supabase JWT ("anon" / "service_role"), for spotting a swapped key. */
function jwtRole(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return "not-a-jwt";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: string };
    return payload.role ?? "no-role-claim";
  } catch {
    return "unreadable";
  }
}

const present = (v: string | undefined) => (v ? "set" : "MISSING");

export default route("status", async function handler(req: any, res: any) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const secret = process.env.STRIPE_SECRET_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const url = supabaseUrl();

  const env = {
    STRIPE_SECRET_KEY: secret ? `set (${secret.slice(0, 7)}…)` : "MISSING",
    STRIPE_WEBHOOK_SECRET: present(process.env.STRIPE_WEBHOOK_SECRET),
    SITE_URL: process.env.SITE_URL ?? "MISSING (falls back to the request host)",
    "SUPABASE_URL / VITE_SUPABASE_URL": url ? "set" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: serviceKey ? `set (role: ${jwtRole(serviceKey)})` : "MISSING",
    "SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY": anon ? `set (role: ${jwtRole(anon)})` : "MISSING",
  };

  const blocking: string[] = [];
  if (!secret) blocking.push("STRIPE_SECRET_KEY");
  if (!url) blocking.push("SUPABASE_URL (or VITE_SUPABASE_URL)");
  if (!serviceKey) blocking.push("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && jwtRole(serviceKey) !== "service_role") blocking.push(`SUPABASE_SERVICE_ROLE_KEY has role "${jwtRole(serviceKey)}" — it must be the service_role key, not the anon key`);

  return json(res, 200, {
    checkoutReady: blocking.length === 0,
    blocking,
    env,
    note: blocking.length === 0 ? "Checkout should work. If it still fails, the error is from Stripe itself." : "Set these in Vercel → Settings → Environment Variables (Production), then redeploy.",
  });
});
