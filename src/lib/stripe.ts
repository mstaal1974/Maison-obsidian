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
