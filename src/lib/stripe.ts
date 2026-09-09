// ─── Stripe: authorize-now / capture-later ───────────────────────────────────
//
// The batch model authorizes a customer's card at commit time and only captures
// when the batch reaches MOQ. That requires a PaymentIntent created with
// `capture_method: "manual"` on the server (the secret key must never touch the
// browser). This module is the client seam:
//
//   • authorizePayment() — in production, POST to a serverless route that runs
//     `stripe.paymentIntents.create({ amount, currency, capture_method:"manual",
//     metadata:{ fragrance_id } })` and returns the intent id; confirm it
//     client-side with Stripe.js. Capture happens later (see the capture-batch
//     Edge Function) once the batch is met; if it closes short, the hold is
//     released.
//
// Until that endpoint exists it is stubbed: it returns a synthetic intent id so
// every commit still records a payment reference and the data model is exercised
// end-to-end.

export interface AuthorizeResult {
  paymentIntentId: string;
  /** "requires_capture" once a real manual-capture intent is wired; "stub" until then. */
  status: "requires_capture" | "stub";
}

const AUTHORIZE_ENDPOINT = import.meta.env.VITE_STRIPE_AUTHORIZE_URL as string | undefined;

function stubIntentId(): string {
  const rand = Math.random().toString(36).slice(2, 12);
  return `pi_stub_${rand}`;
}

/**
 * Authorizes (holds) `amountCents` on the customer's card for a batch commit.
 * Calls the configured serverless endpoint when present; otherwise returns a
 * synthetic intent id so the commit still carries a reference.
 */
export async function authorizePayment(
  fragranceId: string,
  amountCents: number,
): Promise<AuthorizeResult> {
  if (!AUTHORIZE_ENDPOINT) {
    return { paymentIntentId: stubIntentId(), status: "stub" };
  }
  try {
    const res = await fetch(AUTHORIZE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fragranceId, amountCents }),
    });
    if (!res.ok) throw new Error(`authorize failed: ${res.status}`);
    const data = (await res.json()) as { paymentIntentId: string };
    return { paymentIntentId: data.paymentIntentId, status: "requires_capture" };
  } catch {
    // Never block the optimistic commit UI on a payments hiccup.
    return { paymentIntentId: stubIntentId(), status: "stub" };
  }
}

// ─── Hosted Checkout (api/stripe/*) ──────────────────────────────────────────
//
// When the Stripe routes are configured (STRIPE_SECRET_KEY on Vercel), the
// bag and the Monthly Pour go through Stripe Checkout: the browser asks for a
// session URL and redirects; Stripe sends the customer back to #/account with
// a session id, and the webhook / confirm route record the outcome. Each call
// below returns null when the route isn't there, so the app falls back to the
// stub flow above.

import { supabase } from "./supabase";
import type { FormatKey } from "./data";

async function authHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) h.Authorization = `Bearer ${data.session.access_token}`;
  }
  return h;
}

/** Null when the route isn't deployed/configured (404, 501, or an HTML page). */
async function call<T>(path: string, init: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string } | null> {
  if (!supabase) return null;
  try {
    const res = await fetch(path, { ...init, headers: { ...(init.headers as Record<string, string>), ...(await authHeaders()) } });
    const type = res.headers.get("content-type") ?? "";
    if (res.status === 404 || res.status === 501 || !type.includes("application/json")) return null;
    const data = (await res.json()) as T & { error?: string };
    return res.ok ? { ok: true, data } : { ok: false, error: data.error ?? `Request failed (${res.status})` };
  } catch {
    return null;
  }
}

export interface StripeLine {
  fragranceId: string;
  format: FormatKey;
  qty: number;
  engraving: string | null;
  label?: string;
}

/** Bag → a Checkout Session client secret for the embedded form. Null when Stripe isn't configured. */
export async function stripeCheckout(lines: StripeLine[]) {
  return call<{ client_secret: string }>("/api/stripe/checkout", { method: "POST", body: JSON.stringify({ lines }) });
}

/** Monthly Pour → a Checkout Session client secret (subscription). Null when not configured. */
export async function stripeSubscribe(format: FormatKey, fragranceId: string | null, pickMode: "choose" | "surprise") {
  return call<{ client_secret: string }>("/api/stripe/subscribe", { method: "POST", body: JSON.stringify({ format, fragranceId, pickMode }) });
}

export interface ConfirmResult {
  kind: "reservation" | "subscription" | "other";
  lines?: { f: string; k: FormatKey; q: number; e: string | null; s: number; u: number }[];
  amountTotal?: number | null;
}

/** Back from Checkout: make sure the outcome is recorded and learn what it was. */
export async function confirmStripeSession(sessionId: string) {
  return call<ConfirmResult>(`/api/stripe/confirm?session_id=${encodeURIComponent(sessionId)}`, { method: "GET" });
}

export async function cancelStripeSubscription(id: string) {
  return call<{ ok: true }>("/api/stripe/cancel-subscription", { method: "POST", body: JSON.stringify({ id }) });
}

export async function billingPortalUrl() {
  return call<{ url: string }>("/api/stripe/portal", { method: "POST", body: "{}" });
}

/** Admin: capture a met batch's holds, or release a short batch's. */
export async function captureBatch(fragranceId: string, action: "capture" | "release") {
  return call<{ ok: true; results: { id: string; outcome: string }[] }>("/api/stripe/capture", { method: "POST", body: JSON.stringify({ fragranceId, action }) });
}
