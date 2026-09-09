# Stripe integration — remaining steps

Stripe Checkout runs as an **embedded payment form** (Checkout Studio, `ui_mode: "form"`) inside the bag drawer and on the Subscribe page. This file is the single source of truth for what is left to do.

## Values to Replace

No placeholder values remain in the Checkout Session calls. `mode` and `line_items` are real: reservations use `mode: "payment"` with line items priced server-side from the live catalogue, and the Monthly Pour uses `mode: "subscription"` with a monthly `price_data` line. Neither uses a Dashboard Price ID, so there is nothing to swap.

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| — | — | Nothing to replace. |

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**
- [api/stripe/checkout.ts](api/stripe/checkout.ts) — reservations (`mode: "payment"`)
- [api/stripe/subscribe.ts](api/stripe/subscribe.ts) — the Monthly Pour (`mode: "subscription"`)

| Parameter | Value |
|-----------|-------|
| ui_mode | form (Stripe SDK 22.6.1 ≥ 21.0.0) |
| billing_address_collection | auto |
| phone_number_collection | { enabled: false } |
| automatic_tax | { enabled: false } |
| submit_type | auto |
| integration_identifier | custom_embedded_web_0002 |
| payment_method_collection | always (subscription only) |

Kept alongside them because the fulfilment flow depends on them: `customer`, `metadata`, `payment_intent_data` (manual capture + saved card on reservations), `subscription_data` (subscription metadata) and `return_url` (required for the embedded form; replaces the former `success_url` / `cancel_url`).

The server client is pinned to API version `2026-03-25.dahlia; custom_checkout_payment_form_preview=v1` in [api/_lib/stripe.ts](api/_lib/stripe.ts), as the embedded form requires.

## Setup

1. **Keys.** In Vercel → Project → Settings → Environment Variables set:
   - `STRIPE_SECRET_KEY` — server only
   - `STRIPE_WEBHOOK_SECRET` — from the webhook endpoint you create below
   - `VITE_STRIPE_PUBLISHABLE_KEY` — browser; without it the form reports "VITE_STRIPE_PUBLISHABLE_KEY is not set"
   - `SUPABASE_SERVICE_ROLE_KEY` — server only; the webhook and admin capture write with it
   - `SITE_URL` — e.g. `https://maison-obsidian.vercel.app` (return target after payment)
   See [.env.example](.env.example) for local development.
2. **Database.** Apply `supabase/migrations/0015_stripe.sql` (after 0014).
3. **Webhook.** Dashboard → Developers → Webhooks → Add endpoint `https://<your site>/api/stripe/webhook` with events `checkout.session.completed`, `invoice.upcoming`, `invoice.paid`, `customer.subscription.deleted`. Paste its signing secret into `STRIPE_WEBHOOK_SECRET`.
4. **Customer portal.** Dashboard → Settings → Billing → Customer portal → enable, so "Update card & invoices" works for subscribers.
5. **Dependencies.** `stripe` (^22.6.1) is already in `package.json`; Stripe.js loads from `https://js.stripe.com/dahlia/stripe.js` in [index.html](index.html) (never bundled, per PCI).

## Project structure

New or changed for Stripe:

```
api/_lib/stripe.ts            client, catalogue pricing, customer lookup, API version pin
api/_lib/record.ts            idempotent writes shared by webhook + confirm
api/stripe/checkout.ts        Checkout Session for the bag (embedded form)
api/stripe/subscribe.ts       Checkout Session for the Monthly Pour (embedded form)
api/stripe/confirm.ts         on return: record if the webhook hasn't, report outcome
api/stripe/webhook.ts         Stripe events → commits / subscriptions / deliveries
api/stripe/cancel-subscription.ts, portal.ts, capture.ts
src/lib/stripe.ts             browser calls to the routes (null when Stripe isn't configured)
src/lib/stripeForm.ts         Stripe.js init with the embedded-form beta + mount helper
src/components/StripeCheckoutForm.tsx   the <div id="checkout-form"> the SDK renders into
supabase/migrations/0015_stripe.sql
```

## How it works

**Reservations.** The bag drawer's "Reserve & authorise" posts the bag to `/api/stripe/checkout`, which prices every line from the live catalogue and creates a Checkout Session (`mode: "payment"`, manual capture, card saved off-session). The drawer swaps its button for Stripe's embedded form using the returned `client_secret`. After confirmation Stripe sends the customer to `#/account?checkout=success&session_id=…`; the webhook and `/api/stripe/confirm` each record one commit per line, whichever runs first. When a batch is met, the console's Fulfillment tab → "Capture & pour" captures the holds (or charges the saved card if a hold has expired); "Release holds" cancels them if the batch closed short.

**The Monthly Pour.** "Start my subscription" posts to `/api/stripe/subscribe`, which creates a Checkout Session (`mode: "subscription"`) at the first pick's member price and renders the form in the summary panel. Before each renewal, `invoice.upcoming` settles the month's scent (drawing it in surprise mode) and re-prices the subscription; `invoice.paid` records the delivery; the twelfth paid month completes the term and cancels the subscription. Cancelling from the account cancels at Stripe.

**Without Stripe.** If `STRIPE_SECRET_KEY` is unset the routes answer 501 and the site keeps its local stub flow.

## Testing

Use test-mode keys. Cards: `4242 4242 4242 4242` (succeeds), `4000 0025 0000 3155` (requires 3D Secure), `4000 0000 0000 9995` (declined). Any future expiry, any CVC. Watch Vercel function logs for the webhook; each event returns `{ received: true }` on success.

## Next steps

- Decide the currency (`STRIPE_CURRENCY`, default `aud`) before going live.
- Set the Dashboard's public business details (statement descriptor, support email) that appear on receipts.
- Turn on Stripe email receipts, or send your own from the `checkout.session.completed` event.
- Consider extended authorisations if your batches routinely take longer than a card hold allows; the saved-card recharge covers it today.
- Order tracking already lives under Account → My Reservations; the console records shipments per commit.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
