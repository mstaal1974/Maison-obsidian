# Setting up Supabase for Maison Obsidian

This guide takes you from a fresh Supabase account to a fully wired backend:
live catalogue, batch commits, auth (email + Google), VIP, admin console,
Australia Post fulfillment, and persisted concierge transcripts.

**Do you need it?** No — the app runs entirely on seed data + `localStorage`
without Supabase (that's the offline demo). Set Supabase up when you want real
persistence, sign-in, multi-user data, the admin console backed by a database,
and the edge functions. Everything degrades gracefully if a piece is missing.

> Where each secret lives, at a glance:
> - **Frontend** (Vite / Vercel env): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_STRIPE_AUTHORIZE_URL`
> - **Vercel serverless** (`/api/chat`): `ANTHROPIC_API_KEY`
> - **Supabase Edge Function secrets**: `STRIPE_SECRET_KEY`, `AUSPOST_*` (the `SUPABASE_*` ones are injected automatically)
> - **Database row**: your admin user id in the `admins` table

---

## 1. Prerequisites

- A [Supabase](https://supabase.com) account (free tier is fine).
- Node 18+ and this repo cloned locally (`npm install`).
- Optional, for edge functions: the [Supabase CLI](https://supabase.com/docs/guides/cli)
  (`npm i -g supabase` or `brew install supabase/tap/supabase`).

---

## 2. Create a project and grab the keys

1. Supabase dashboard → **New project**. Pick an org, name (e.g. `maison-obsidian`),
   a strong database password (save it), and a region close to your users.
2. Wait for it to provision (~2 min).
3. Go to **Project Settings → API** and copy:
   - **Project URL** → this is `VITE_SUPABASE_URL` (e.g. `https://abcd1234.supabase.co`)
   - **Project API keys → `anon` `public`** → this is `VITE_SUPABASE_ANON_KEY`

The `anon` key is safe to expose in the browser — Row-Level Security (defined by
the migrations) governs what it can read and write. **Never** put the `service_role`
key in the frontend.

---

## 3. Apply the database schema

The schema lives in [`supabase/migrations/`](../supabase/migrations), applied in
order:

| File | Adds |
| --- | --- |
| `0001_init.sql` | `fragrances`, `commits`, `subscribers`; committed-count trigger; `commit_to_batch` + `enroll_subscriber` RPCs; RLS |
| `0002_seed.sql` | The 25-fragrance catalogue (idempotent) |
| `0003_admin_inventory.sql` | `admins` + `is_admin()`; per-size stock columns; fragrance CRUD / inventory RPCs |
| `0004_shipments.sql` | `shipments`; admin fulfillment RPCs; admin read policy on commits |
| `0005_chat.sql` | `chat_messages` + `log_chat_message` RPC (concierge transcripts) |
| `0006_oil_inventory.sql` | `oil_ml` column + `admin_set_oil` RPC (raw oil on hand); `commit_size_counts` RPC (outstanding commitments per size, for oil-demand coverage) |
| `0007_reconcile_committed.sql` | Recomputes `fragrances.committed` from real commit rows (discards the static launch numbers seeded in 0002) and makes the sync trigger count only `authorized`/`captured`, so the batch bar always equals the per-size panel |

### Option A — SQL Editor (simplest, always works)

1. Dashboard → **SQL Editor → New query**.
2. Open `supabase/migrations/0001_init.sql`, paste the whole file, **Run**.
3. Repeat for `0002` → `0007`, **in order**. Each should report success.
   (You'll see a few `NOTICE ... does not exist, skipping` lines — harmless; they
   come from the idempotent `drop ... if exists` guards.)

### Option B — Supabase CLI

```bash
supabase login
supabase link --project-ref <your-project-ref>   # ref is the subdomain in your Project URL
supabase db push                                  # applies everything in supabase/migrations in order
```

**Catching up a project that is behind.** The migrations build on each other, so a later
one fails on a project missing an earlier one (for example `column f.format_status does not
exist` means `0009` was never applied). Run them in numeric order, or paste them all into one
SQL Editor run: every migration except `0002_seed.sql` is safe to re-run, and the seed should
be skipped on a project whose catalogue you have already edited.

```bash
```

> If `db push` complains about migration naming/versioning, use Option A — the SQL
> Editor doesn't care about filename conventions.

### Verify

Dashboard → **Table Editor**: you should see `fragrances` (25 rows), plus empty
`commits`, `subscribers`, `admins`, `shipments`, `chat_messages`.

---

## 4. Point the frontend at Supabase

### Local development

Create `.env.local` in the repo root (it's git-ignored):

```env
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

Then `npm run dev`. On load the catalogue now comes from the database (the store
reports `source: "supabase"`), and commits/VIP/auth persist.

### Production (Vercel)

Vercel → Project → **Settings → Environment Variables**, add the same two
`VITE_…` vars (Production + Preview), then redeploy. `VITE_`-prefixed vars are
embedded in the client bundle at build time — that's expected and safe for the
anon key.

---

## 5. Enable authentication

**Email/password** works out of the box once the keys above are set — no extra
config. (For zero-friction testing, Dashboard → **Authentication → Providers →
Email** → you may turn *Confirm email* off so sign-ups log in immediately.)

**Google sign-in:**

1. In **Google Cloud Console** → APIs & Services → Credentials → **Create OAuth
   client ID** (type: Web application). Add an authorized redirect URI:
   `https://<your-ref>.supabase.co/auth/v1/callback`. Copy the Client ID + Secret.
2. Supabase → **Authentication → Providers → Google** → enable, paste the Client
   ID + Secret, save.
3. Supabase → **Authentication → URL Configuration**: set **Site URL** to your app
   origin (e.g. `http://localhost:5173` for dev, and your Vercel URL for prod), and
   add both origins to **Redirect URLs**.

The `AuthModal` already calls `signInWithPassword`, `signUp`, and
`signInWithOAuth({ provider: "google" })`; no code changes needed.

---

## 6. Make yourself an admin

The admin console (`#/admin`) is gated by the `admins` table.

1. Sign in to the app at least once (so your user exists).
2. Supabase → **Authentication → Users**, copy your user's **UUID**.
3. SQL Editor:

   ```sql
   insert into public.admins (user_id) values ('<your-user-uuid>');
   ```

Reload the app → the **Account menu** now shows **Admin Console**, and the admin
RPCs (`admin_upsert_fragrance`, `admin_set_stock`, `admin_create_shipment`, …)
will accept your calls. Everyone else is rejected by `is_admin()`.

---

## 7. (Optional) Deploy the Edge Functions

Two functions live in [`supabase/functions/`](../supabase/functions):

- **`capture-batch`** — removed. Cards are charged at checkout, so there is nothing to capture later. (Older deployments may still have this function; it can be deleted.) It previously captured held intents when a batch was met (or
  releases them if it closes short).
- **`create-shipment`** — buys an Australia Post Parcel Post label and records the
  shipment.

Deploy (CLI, from the repo root, project already linked):

```bash
supabase functions deploy capture-batch
supabase functions deploy create-shipment
```

Set the third-party secrets (the `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
the functions use are **injected automatically** by Supabase — you cannot and
need not set `SUPABASE_`-prefixed secrets yourself):

```bash
# Stripe capture (capture-batch)
supabase secrets set STRIPE_SECRET_KEY=sk_live_...

# Australia Post Parcel Post (create-shipment)
supabase secrets set \
  AUSPOST_PAC_KEY=... \
  AUSPOST_API_KEY=... AUSPOST_API_PASSWORD=... AUSPOST_ACCOUNT_NUMBER=... \
  AUSPOST_PRODUCT_ID=T28 \
  AUSPOST_FROM_NAME="Maison Obsidian" AUSPOST_FROM_LINE1="1 Atelier Ln" \
  AUSPOST_FROM_SUBURB=Perth AUSPOST_FROM_STATE=WA AUSPOST_FROM_POSTCODE=6000
```

Invoke them from an admin action or a scheduled job, e.g.:

```bash
curl -X POST "https://<your-ref>.supabase.co/functions/v1/capture-batch" \
  -H "Authorization: Bearer <service-role-or-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"fragranceId":"f1","action":"capture"}'
```

Without these secrets both functions run in a safe stub mode (synthetic
tracking / no real capture), so nothing breaks while you wire the real accounts.

---

## 8. (Optional) The non-Supabase keys

Two integrations live **outside** Supabase — listed here so the picture is complete:

- **Concierge + AI conception (Claude)** — set `ANTHROPIC_API_KEY` in the **Vercel** project
  (server-side, not `VITE_`). Powers `/api/chat` and `/api/conceive` (the admin console's
  **Conceive with AI**). Without it the widget uses its local fallback and the conception
  panel reports that it isn't configured. `/api/conceive` checks the caller against
  `is_admin()` using `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (already in the Vercel
  project) — or `SUPABASE_URL` / `SUPABASE_ANON_KEY` if you prefer server-only names.
- **Formats** — migration `0009_formats.sql` adds the per-format price/status maps and
  car / wash / moisturiser stock to `fragrances`, a `format` + `qty` on `commits`, the
  `admin_set_formats` RPC behind the admin **Product Matrix**, and re-creates
  `commit_to_batch` with the two extra arguments. Apply it after `0008`.
- **The Monthly Pour (subscriptions)** — migration `0012_subscriptions.sql` adds
  `scent_subscriptions` and `subscription_deliveries` with the RPCs `start_subscription`
  (customer; records month 1 as paid), `set_subscription_pick`, `cancel_subscription`
  and `bill_subscription_month` (admin / payment processor; records the next month's
  charge and delivery, marking the subscription complete on month 12). Customers see
  and manage their subscription under **Account**; admins triage every subscription
  under the console's **Monthly Pour** tab. Apply it after `0011`. Migration
  `0013_subscription_surprise.sql` adds the pick mode: **choose** (the customer picks each
  month) or **surprise** (the house draws at random via `draw_subscription_scent`, never
  repeating a scent already sent on that subscription), plus `set_subscription_mode`.

  The monthly charge itself is the payment processor's job. Wire Stripe Subscriptions
  (or a scheduled job) so that each successful monthly payment calls
  `bill_subscription_month(id, charge_cents, payment_intent_id)`; until then the admin
  console's **Bill month N** button records a month by hand through the same RPC, using
  the `VITE_STRIPE_AUTHORIZE_URL` endpoint (or the stub) for the charge.
- **Consent, profiles and marketing** — migration `0014_profiles_marketing.sql` adds
  `customer_profiles` (two consents per account holder, both off by default: marketing
  email and AI personalisation, each with the time and source of opt-in),
  `marketing_signups` (the inner-circle list by email, fed by the footer box and mirrored
  from account consents), the `marketing_audience` view for the console, the RPCs
  `join_inner_circle` and `set_my_consents`, a customers-read-their-own policy on
  `scent_requests`, and a `bill_subscription_month` that accepts a taste-led pick for
  surprise subscriptions. Apply it after `0013`.

  What the data is used for, and only with consent: the concierge (`/api/chat`) receives a
  short taste summary built in the browser from the customer's own history when they have
  allowed personalisation; the Monthly Pour surprise draw leans toward that taste; the
  console's **Marketing** tab lists everyone who opted in to email with their taste
  profile, exports a CSV for your email tool, and drafts a note per segment via
  `/api/marketing` (admin-only, uses `ANTHROPIC_API_KEY`). Customers change or withdraw
  both consents under **Account → Privacy & preferences**. Email sends and unsubscribe links
  are your email tool's job; keep its list in step with the CSV export.
- **Delivery method** — migration `0016_delivery_method.sql` records, per order, whether it
  ships via Australia Post or is delivered by arrangement, along with the contact name,
  mobile and instructions the customer gave. The console's Fulfillment tab flags the
  arranged ones. Apply it after `0015`.
- **Scent requests** — migration `0010_scent_requests.sql` adds the `scent_requests` table
  and the `request_scent` RPC. When **Find my match** has nothing for what a customer
  typed (or only nearest profiles), they can request it; the asks land in the admin
  console's **Requests** tab, grouped with a count, where you mark them sourced or
  declined. Anonymous visitors can request; only admins can read. Apply it after `0009`.
- **Bottle images** — migration `0008_ai_conception.sql` creates the public
  `fragrance-images` storage bucket (4 MB) with admin-only writes, and
  `0011_jpeg_bottle_images.sql` widens it from PNG/WebP to JPG as well. Nothing else to
  configure; uploads from the admin console land there and the public URL is stored on
  `fragrances.image_url`. A transparent PNG sits on the tinted backdrop; a JPG shows as
  full-frame photography.
- **Stripe (hosted Checkout)** — migration `0015_stripe.sql` plus four Vercel variables
  turn on real payments; without them the bag and the Monthly Pour keep the local stub
  (`pi_stub_*` ids) so the demo still works.

  1. In Vercel → Settings → Environment Variables add:
     `STRIPE_SECRET_KEY` (sk_test_… to start), `SUPABASE_SERVICE_ROLE_KEY` (Supabase →
     Settings → API; server-side only, never `VITE_`), `SITE_URL`
     (`https://maison-obsidian.vercel.app`), and optionally `STRIPE_CURRENCY` (default `aud`).
  2. In Stripe → Developers → Webhooks add an endpoint for
     `https://<site>/api/stripe/webhook` with the events `checkout.session.completed`,
     `invoice.upcoming`, `invoice.paid` and `customer.subscription.deleted`, then put its
     signing secret in `STRIPE_WEBHOOK_SECRET` and redeploy.
  3. Turn on the Customer Portal (Stripe → Settings → Billing → Customer portal) so
     "Update card & invoices" works for subscribers.

  How it behaves. **Reservations**: the bag goes to Stripe Checkout; prices are computed
  server-side from the live catalogue; the card is charged at checkout and the
  card is saved off-session. The webhook (or `/api/stripe/confirm` when the customer
  returns) records one paid order row per line, which the customer sees under **My Orders**.
  **The Monthly Pour**: a real Stripe subscription, monthly, priced at the first pick's
  member price. Three days before each renewal Stripe sends `invoice.upcoming`; the
  webhook settles that month's scent (drawing it in surprise mode) and re-prices the
  subscription to it. `invoice.paid` records the delivery; after the twelfth it cancels
  the subscription. Cancelling from the account cancels at Stripe immediately.
  Test with card `4242 4242 4242 4242`, any future expiry, any CVC.

- **Stripe authorize endpoint (legacy)** — `VITE_STRIPE_AUTHORIZE_URL` is the older
  hook for a route that mints a manual-capture PaymentIntent; superseded by the hosted
  Checkout above and only used when that isn't configured.

See [`.env.example`](../.env.example) for the full annotated list.

---

## 9. Verify end-to-end

1. **Catalogue is live** — edit a fragrance's tagline in Table Editor; reload the
   app and confirm the change shows (proves reads come from the DB, not seed).
2. **Auth** — sign up / sign in; the header shows your email under **Account**.
3. **Commit** — commit to a batch; a row appears in `commits` (Table Editor), and
   the fragrance's `committed` count increments (the trigger). It also shows under
   **My Reservations**.
4. **VIP** — join the VIP club; a row appears in `subscribers` with `tier = 'vip'`,
   and VIP-only scents unlock.
5. **Admin** — after §6, open the Admin Console, add/edit a scent and set stock;
   confirm the change in `fragrances`.
6. **Concierge transcripts** — chat with the concierge; rows appear in
   `chat_messages` (visible to you via RLS, and to admins).

---

## 10. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| App still shows seed data | `VITE_…` vars not set, or not rebuilt/redeployed after setting them. In prod they're baked in at build time — redeploy. |
| `permission denied` / empty reads | RLS is working as intended — you're reading rows you don't own. Sign in, or (for admin views) add yourself to `admins`. |
| Google sign-in loops or errors | Redirect URI mismatch — the Google console URI must be `https://<ref>.supabase.co/auth/v1/callback`, and your app origin must be in Supabase → Auth → URL Configuration. |
| Admin Console says "Admins only" | You aren't in the `admins` table (§6), or you added the wrong UUID. |
| Edge function returns 501 | Its secrets aren't set — it's in stub mode. Set the `STRIPE_`/`AUSPOST_` secrets and redeploy. |
| `db push` fails on migration versioning | Use the SQL Editor (Option A). |

---

## 11. Environment variable reference

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend (Vite/Vercel) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Browser-safe anon key (RLS-guarded) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `SITE_URL` | Vercel serverless | Stripe Checkout and its webhook — see `STRIPE_INTEGRATION_TODO.md` |
| `VITE_STRIPE_AUTHORIZE_URL` | Frontend | Legacy stub endpoint; unused once the Stripe routes are configured |
| `ANTHROPIC_API_KEY` | Vercel serverless | Concierge (`/api/chat`) + AI conception (`/api/conceive`) — server-side only |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Vercel serverless (optional) | Admin check for `/api/conceive`; falls back to the `VITE_` pair |
| `STRIPE_SECRET_KEY` | Vercel serverless (and Supabase Edge secret) | Hosted Checkout, subscriptions, capture (`/api/stripe/*`); `capture-batch` Edge Function |
| `STRIPE_WEBHOOK_SECRET` | Vercel serverless | Verifies `/api/stripe/webhook` deliveries |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel serverless | Webhook / confirm / capture write commits and subscriptions (bypasses RLS; never `VITE_`) |
| `SITE_URL` | Vercel serverless | Where Checkout returns the customer (falls back to the request host) |
| `STRIPE_CURRENCY` | Vercel serverless (optional) | Checkout currency, default `aud` |
| `AUSPOST_PAC_KEY` | **Vercel serverless** + Supabase Edge secret | Postage rates at checkout (`/api/shipping/quote`) and label costing |
| `AUSPOST_FROM_POSTCODE` | **Vercel serverless** + Supabase Edge secret | Where parcels are posted from, for rate lookups |
| `AUSPOST_API_KEY` / `AUSPOST_API_PASSWORD` / `AUSPOST_ACCOUNT_NUMBER` / `AUSPOST_PRODUCT_ID` | Supabase Edge secret | Parcel Post label creation |
| `AUSPOST_FROM_NAME/_LINE1/_SUBURB/_STATE/_POSTCODE` | Supabase Edge secret | Sender address |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Edge (auto-injected) | Do **not** set manually — Supabase provides these to functions |
