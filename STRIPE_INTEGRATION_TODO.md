# Stripe integration — remaining steps

Stripe Checkout runs as a **hosted page** (Checkout Studio, `ui_mode: "hosted_page"`): the bag and the Subscribe page redirect the customer to Stripe's own payment page, and Stripe returns them to the account page. Payment is taken at checkout, like any normal store. This file is the single source of truth for what is left to do.

## Values to Replace

No placeholder values remain. `mode`, `success_url`, `cancel_url` and `line_items` all hold real values: reservations use `mode: "payment"` with line items priced server-side from the live catalogue, and the Monthly Pour uses `mode: "subscription"` with a monthly `price_data` line. Neither uses a Dashboard Price ID, so there is nothing to swap.

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| — | — | Nothing to replace. |

The success and cancel URLs are built from `SITE_URL` at request time (falling back to the request's own host), so they follow whichever domain the site is deployed on.

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**
- [api/stripe/checkout.ts](api/stripe/checkout.ts) — reservations (`mode: "payment"`)
- [api/stripe/subscribe.ts](api/stripe/subscribe.ts) — the Monthly Pour (`mode: "subscription"`)

| Parameter | Value |
|-----------|-------|
| ui_mode | hosted_page (Stripe SDK 22.6.1 ≥ 21.0.0) |
| billing_address_collection | auto |
| phone_number_collection | { enabled: false } |
| automatic_tax | { enabled: false } |
| allow_promotion_codes | false |
| submit_type | auto |
| integration_identifier | hosted_web_0001 |
| origin_context | web |
| payment_method_collection | always (subscription only) |

Kept alongside them because the fulfilment flow depends on them: `customer`, `metadata`, `payment_intent_data` (order metadata) and `subscription_data` (subscription metadata).

The Stripe client is created with no `apiVersion`, so your account's default API version applies — see [api/_lib/stripe.ts](api/_lib/stripe.ts).

## Setup

1. **Keys.** In Vercel → Project → Settings → Environment Variables, for the **Production** environment:
   - `STRIPE_SECRET_KEY` — server only
   - `STRIPE_WEBHOOK_SECRET` — from the webhook endpoint below
   - `SUPABASE_SERVICE_ROLE_KEY` — server only; the webhook and admin capture write with it
   - `SITE_URL` — e.g. `https://maisonobsidian-zeta.vercel.app` (where Stripe returns the customer)
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` — the functions read the catalogue and identify the
     customer with these. The `VITE_`-prefixed pair in `.env` is baked into the browser bundle at
     build time and is **not** visible to serverless functions at runtime, so set these unprefixed
     names in Vercel as well (same values).
   Hosted Checkout needs **no publishable key**: the browser never talks to Stripe directly. Environment variables apply to new deployments only, so redeploy after saving. See [.env.example](.env.example) for local development.
2. **Database.** Apply `supabase/migrations/0015_stripe.sql` (after `0014`).
3. **Webhook.** Dashboard → Developers → Webhooks → Add endpoint `https://<your site>/api/stripe/webhook` with events `checkout.session.completed`, `invoice.upcoming`, `invoice.paid`, `customer.subscription.deleted`. Paste its signing secret into `STRIPE_WEBHOOK_SECRET`.
4. **Customer portal.** Dashboard → Settings → Billing → Customer portal → enable, so "Update card & invoices" works for subscribers.
5. **Dependencies.** `stripe` (^22.6.1) is already in `package.json`. Nothing to load in the browser.

## Project structure

Files behind the Stripe integration:

```
api/_lib/stripe.ts            client, catalogue pricing, customer lookup, config checks
api/_lib/catalogue.ts         pricing rules mirrored from src/lib/formats.ts
api/_lib/record.ts            idempotent writes shared by webhook + confirm
api/stripe/checkout.ts        hosted Checkout Session for the bag (charges at checkout)
api/stripe/subscribe.ts       hosted Checkout Session for the Monthly Pour
api/stripe/confirm.ts         on return: record if the webhook hasn't, report outcome
api/stripe/webhook.ts         Stripe events → commits / subscriptions / deliveries
api/stripe/cancel-subscription.ts, portal.ts, status.ts
src/lib/stripe.ts             browser calls to the routes (null when Stripe isn't configured)
supabase/migrations/0015_stripe.sql
```

## How it works

**Orders.** "Checkout" posts the bag to `/api/stripe/checkout`, which prices every line from the live catalogue and creates a hosted Checkout Session (`mode: "payment"`). The browser redirects to `session.url`. The card is charged when the customer pays. Stripe then returns them to `#/account?checkout=success&session_id=…`; the webhook and `/api/stripe/confirm` each record one paid order row per line, whichever runs first. Orders appear under **My Orders**, and the console's Fulfillment tab creates the shipment and tracking.

**The Monthly Pour.** "Start my subscription" posts to `/api/stripe/subscribe`, which creates a hosted Checkout Session (`mode: "subscription"`) at the first pick's member price and redirects. Before each renewal, `invoice.upcoming` settles the month's scent (drawing it in surprise mode) and re-prices the subscription; `invoice.paid` records the delivery; the twelfth paid month completes the term and cancels the subscription. Cancelling from the account cancels at Stripe.

**Without Stripe.** If `STRIPE_SECRET_KEY` or the Supabase service-role key is missing, the routes answer 501 naming what is absent, and the site falls back to its local hold flow.

## Checking the configuration

Open **`https://<your site>/api/stripe/status`** in a browser. It reports which environment variables the serverless functions can actually see, and whether the Supabase service-role key really carries the `service_role` claim (a common mistake is pasting the anon key into that slot). It never returns key material. `checkoutReady: true` means the routes have everything they need.

## Testing

Use test-mode keys. Cards: `4242 4242 4242 4242` (succeeds), `4000 0025 0000 3155` (requires 3D Secure), `4000 0000 0000 9995` (declined). Any future expiry, any CVC. Watch the Vercel function logs for the webhook; each event returns `{ received: true }` on success.

## Next steps

- Decide the currency (`STRIPE_CURRENCY`, default `aud`) before going live.
- Set the Dashboard's public business details (statement descriptor, support email) that appear on receipts and on the hosted page.
- Brand the hosted page under Dashboard → Settings → Branding (logo, colours) so it matches the house.
- Turn on Stripe email receipts, or send your own from the `checkout.session.completed` event.
- Order tracking already lives under Account → My Reservations; the console records shipments per commit.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
