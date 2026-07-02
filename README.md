# Maison Obsidian

A premium **Boutique Laboratory** storefront for a batch-atelier fragrance house,
built from the *Fragrance ecommerce redesign* handoff (`Maison Obsidian.dc.html`).

Maison Obsidian pours each scent in small numbers. Customers **commit** to a batch —
their card is *authorized, never charged* — and the lab only opens (and captures
payment) once the batch reaches its minimum. Every bottle can be engraved with the
buyer's name, date, or a secret.

> **Aesthetic** — Modern Apothecary × High-End Minimalist. Deep obsidian (`#0b0b0d`),
> gold (`#c9a961`), parchment cream (`#f3ecdc`); Cormorant Garamond headings,
> Hanken Grotesk body, Space Mono data.

---

## Quickstart

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # type-check (tsc -b) + production build to dist/
npm run preview  # serve the production build
npm run lint     # eslint
```

No backend is required to demo the app — the catalogue, batch counters, gender
filters, engraving preview, commit flow, VIP enrolment and commit drawer all run
client-side against the seed data in `src/lib/data.ts`, and commits persist to
`localStorage`. Point it at a Supabase project and the same UI reads and writes
live data instead, with the seed as an automatic fallback.

> **Wiring up the backend?** Follow the step-by-step guide in
> [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) — project creation, applying the
> migrations, env vars, auth (email + Google), granting admin, and deploying the edge
> functions.

---

## What's implemented

Faithful to the redesign comp:

- **Header** — sticky, blurred; The Vault / The Method / VIP Club nav; commit
  counter; Sign In (auth modal) ↔ Account menu with the signed-in email + Sign Out.
- **Authentication** — real Supabase Auth: email/password + Google OAuth via an
  `AuthModal`; commits and VIP enrolment are tied to the signed-in user. Falls back
  to a local demo user when Supabase isn't configured.
- **My Reservations** (`#/account`) — the signed-in user's commits from the
  `commits` table (RLS-scoped), each with size, price held, engraving and a status
  badge; falls back to local commits in the demo.
- **Payments** — authorize-later Stripe: each commit authorizes a hold and records
  a `payment_intent_id`; a `capture-batch` Edge Function captures the holds when the
  batch is met (or releases them if it closes short).
- **Admin console** (`#/admin`, admins only) — add / edit / remove fragrances and
  manage per-size inventory (with low-stock flags), track raw oil on hand against
  per-size commitment demand, plus a fulfillment queue that turns commits into
  shipments.
- **Shipping / fulfillment** — a Supabase-native `shipments` model; admins create
  shipments (carrier + tracking), and each customer sees status + a tracking link on
  their reservations. Fulfillment defaults to **Australia Post Parcel Post**, and the
  `create-shipment` Edge Function is wired to the Australia Post PAC (rates) and
  Shipping & Tracking (labels) APIs.
- **Concierge chatbot** — a floating assistant powered by **Claude** (`claude-opus-4-8`)
  through a server-side `/api/chat` proxy (the key never touches the browser). It streams
  answers about the house, the batch model, sizes, engraving, VIP and shipping, and
  recommends from the live catalogue; falls back to a local rule-based concierge when the
  API key isn't set.
- **Hero** — atmospheric landing with the four brand stats (30% · 4wk · 20 · DXB).
- **The Vault** — catalogue with **All / For Him / For Her** tabs and two layouts a
  floating switch toggles between: **Gallery** (liquid-swatch cards) and **Ledger**
  (dense table). Each entry shows live `committed / moq` progress and VIP / Batch-Met
  badges.
- **Product detail** — hash-routed at `#/fragrance/:slug`; story, composition
  (top / heart / base), stats, a **10 / 30 / 50 ml size selector** that drives the
  volume, price and commit total, the **Custom Engraving engine** with a live label
  preview, and the batch progress + *Commit to this Batch* CTA.
- **The Method** — the four movements (Source → Macerate → Commit → Pour).
- **VIP Club** — email enrolment that writes to the `subscribers` table (via the
  `enroll_subscriber` RPC) and unlocks VIP-only batches.
- **Commit drawer** — slide-out confirming the reserved batch, chosen size + price,
  engraving, and the authorize-not-charge promise.
- **Footer** + film-grain overlay, responsive breakpoints, and reduced-motion support.

## Architecture

```
index.html                 Fonts (Cormorant Garamond · Hanken Grotesk · Space Mono), meta
src/
├── main.tsx               Entry — mounts <App>, imports index.css
├── index.css              Base tokens, grain overlay, keyframes, hover states, breakpoints
├── App.tsx                State + hash-routing shell (home ⇄ product), commit persistence
├── lib/
│   ├── data.ts            Fragrance type, seed catalogue, design tokens, helpers
│   ├── supabase.ts        Null-safe Supabase client + row types
│   ├── auth.ts            useAuth() — Supabase Auth (email + Google) w/ demo fallback
│   ├── admin.ts           useIsAdmin() + fragrance CRUD / inventory / fulfillment ops
│   ├── catalogue.ts       In-memory demo stores (catalogue + shipments) for offline
│   ├── stripe.ts          authorizePayment() — authorize-later hold (stub + real seam)
│   ├── concierge.ts       Chatbot: catalogue summary, streaming client, offline fallback
│   └── store.ts           useFragrances() + recordCommit() + fetch{MyCommits,MyShipments}()
└── components/
    ├── Header.tsx  Hero.tsx  Vault.tsx  FragranceCard.tsx
    ├── Method.tsx  VIP.tsx   ProductDetail.tsx  CommitDrawer.tsx
    ├── AuthModal.tsx  MyReservations.tsx  AdminConsole.tsx  ChatWidget.tsx
    ├── Footer.tsx  LayoutSwitch.tsx  Logo.tsx
api/
└── chat.ts                Vercel serverless proxy → Claude (streams the concierge reply)
public/assets/             Bottle imagery (hero portrait, PDP, pair, square)
supabase/
├── migrations/
│   ├── 0001_init.sql            Schema, committed-sync trigger, commit_to_batch RPC, RLS
│   ├── 0002_seed.sql            Seed catalogue — 25 fragrances (mirrors src/lib/data.ts)
│   ├── 0003_admin_inventory.sql admins + is_admin(), stock columns, fragrance CRUD RPCs
│   ├── 0004_shipments.sql       shipments table, RLS, admin fulfillment RPCs
│   ├── 0005_chat.sql            concierge transcripts + log_chat_message RPC, RLS
│   └── 0006_oil_inventory.sql   oil_ml + admin_set_oil; commit_size_counts (per-size demand)
└── functions/
    ├── capture-batch/     Edge Function: capture/release held intents on batch met
    └── create-shipment/   Edge Function: Australia Post Parcel Post rate + label
```

### The batch model

Each fragrance carries an `moq` (minimum order quantity) and a seeded `committed`
count. Committing to a batch adds the customer's reservation on top of the seed and
opens the drawer. When `committed >= moq` the card/PDP show **Batch Met**. In a
production build this is where the authorize-later Stripe intent would be captured
and the admin notified.

## Database (Supabase)

The backend is three tables plus a trigger, an RPC, and Row-Level Security, defined
as ordered migrations under `supabase/migrations/`:

| Object | Purpose |
| --- | --- |
| `fragrances` | Catalogue (25 scents); columns mirror the `Fragrance` type 1:1, with per-size pricing (`price_10ml_cents` / `_30ml_` / `_50ml_`). Public read. |
| `commits` | Batch reservations (engraving, chosen `size_ml` + `charge_cents`, `authorized`/`captured`/`released`/`void`, optional `payment_intent_id`). Anyone may insert; users read their own. |
| `subscribers` | General list + `vip` tier (gates VIP-only batches). |
| `sync_fragrance_committed()` trigger | Keeps `fragrances.committed` in step as commits are inserted / released. |
| `commit_to_batch(fragrance_id, engraving, size_ml, charge_cents, payment_intent_id)` | `SECURITY DEFINER` RPC that inserts a commit and returns `(committed, moq, met)` atomically; rejects VIP-only batches unless the caller is a VIP subscriber. |
| `enroll_subscriber(email, tier)` | `SECURITY DEFINER` RPC that upserts a subscriber (default `vip`), tying it to the signed-in user when present. |

The batch model: a fragrance pours only once `committed >= moq`. Each commit
**authorizes, never charges** — capture the held Stripe intents once the batch is met
(and release them if it closes short). See the SQL comments for the production wiring.

### Admin, inventory & fulfillment

`0003_admin_inventory.sql` adds an `admins` table and an `is_admin()` guard, per-size
stock columns on `fragrances` (`stock_10ml/30ml/50ml` + `low_stock_threshold`), and
`SECURITY DEFINER` RPCs that only an admin may call: `admin_upsert_fragrance(jsonb)`,
`admin_delete_fragrance(id)`, `admin_set_stock(...)`, `admin_adjust_stock(...)`. Direct
table writes stay closed by RLS; every mutation goes through a guarded RPC.

`0006_oil_inventory.sql` adds an `oil_ml` column (raw perfume oil on hand — bottles
are filled into 10/30/50 ml on demand) set via `admin_set_oil(id, ml)`, and a
`commit_size_counts()` RPC returning outstanding commitments grouped by fragrance and
size. The Catalogue tab uses these to show commitments per size (`10 · n / 30 · n /
50 · n`) and an oil-coverage line — implied demand (`10·q₁₀ + 30·q₃₀ + 50·q₅₀` ml)
against oil on hand — flagged `covered` or `short N ml`.

`0004_shipments.sql` adds a `shipments` table (status, carrier, tracking, `ship_to`,
provider) with RLS so customers read their own and admins read all, plus
`admin_create_shipment(...)` and `admin_set_shipment_status(...)`.

Fulfillment uses **Australia Post Parcel Post**. The `create-shipment` Edge Function
rates the parcel via the Australia Post PAC API (`service_code=AUS_PARCEL_REGULAR`)
and buys a label via the Shipping & Tracking API, storing the article id as the
tracking number and linking to `auspost.com.au/mypost/track`. Set the `AUSPOST_*`
secrets (see `.env.example`); without them it falls back to a stub article id so the
flow still runs. The commit engine is untouched — this is fulfillment only.

The **Admin Console** (`#/admin`) surfaces all of this: a Catalogue tab (add / edit /
remove, inline per-size stock with low-stock flags, raw oil on hand, and per-size
commitment counts with oil-coverage) and a Fulfillment tab (commits →
create shipment). Make a user an admin with
`insert into admins(user_id) values ('<auth-user-id>');`. In the offline demo any
signed-in user is treated as an admin and edits are in-memory.

> Make an admin: grab the id from Supabase → Authentication → Users, then run the
> insert above in the SQL editor.

### Authentication

`src/lib/auth.ts`'s `useAuth()` wraps Supabase Auth — `signInWithPassword`, `signUp`,
and `signInWithOAuth({ provider: 'google' })` — and tracks the live session via
`onAuthStateChange`. The `<AuthModal>` exposes email/password (sign in + sign up) and
a Google button. When Supabase isn't configured it falls back to a local demo user so
the whole flow stays testable offline.

Because requests now carry the user's JWT, the server enforces ownership end-to-end:
`commit_to_batch` stamps `user_id = auth.uid()` on every commit, and the VIP gate
(`subscribers.user_id = auth.uid()` with `tier = 'vip'`) is real — a signed-in VIP
passes, everyone else is rejected. `enroll_subscriber` ties the subscriber row to the
signed-in user, so returning members are recognised on next sign-in.

To enable **Google** sign-in: Supabase → Authentication → Providers → Google (add a
Google OAuth client id/secret), then add your app origin(s) to Authentication → URL
Configuration → Redirect URLs. Email/password needs no extra setup.

### Payments (Stripe, authorize-later)

The batch model holds a card at commit time and only charges when the batch is met:

1. **Authorize** — `src/lib/stripe.ts` `authorizePayment()` POSTs to
   `VITE_STRIPE_AUTHORIZE_URL`, a serverless route that runs
   `stripe.paymentIntents.create({ amount, currency, capture_method: "manual", … })`
   and returns the intent id. The id is stored on the commit (`payment_intent_id`).
   Until that endpoint exists it returns a `pi_stub_*` id so the flow is exercised.
2. **Capture / release** — `supabase/functions/capture-batch` is an Edge Function
   (service-role) that, for a fragrance, captures every `authorized` commit's intent
   and marks it `captured` once `committed >= moq` — or cancels the holds and marks
   them `released` if the batch closes short (the trigger frees those spots). Deploy
   with `supabase functions deploy capture-batch` and set `STRIPE_SECRET_KEY` +
   `SUPABASE_SERVICE_ROLE_KEY` via `supabase secrets set`; trigger it from an admin
   action or scheduled job.

> Live Stripe isn't exercised in this environment — the client authorize is stubbed
> and the Edge Function is wired to the real Stripe/Supabase SDKs but ships as a
> deployable stub. The rest (intent id on every commit, status lifecycle) is real.

### Concierge chatbot (Claude)

A floating concierge (`ChatWidget`) answers questions about the house and recommends
scents. It talks to Claude through **`api/chat.ts`**, a Vercel serverless function that
holds `ANTHROPIC_API_KEY` server-side and streams the reply back as plain text — the key
never reaches the browser. The client sends the conversation plus a compact **live
catalogue summary** (`concierge.ts`), and the function prepends a house system prompt
(brand voice, batch model, sizes, engraving, VIP, Australia Post shipping) and streams
`claude-opus-4-8`.

Set `ANTHROPIC_API_KEY` in the Vercel project (Settings → Environment Variables). When
it's absent — or in the offline demo — the widget falls back to a **local rule-based
concierge** (`localFallbackReply`) so it still answers the common questions.

Three refinements on top:

- **Rate limit** — `/api/chat` enforces a best-effort **20 requests/min per IP** (sliding
  window; returns `429` + `Retry-After`, which the widget surfaces as a "give me a moment"
  message). It's per warm serverless instance — back it with Upstash/Redis or a Supabase
  table for strict distributed limits.
- **Transcripts** — messages persist to `chat_messages` via the `log_chat_message` RPC
  (`0005_chat.sql`), which stamps `user_id` from `auth.uid()` (null for anonymous). RLS lets
  customers read their own and admins read all; writes go through the RPC only.
- **Deep links** — the concierge names scents exactly as in the catalogue, and the widget
  turns those names into **clickable product links** (`linkifyFragrances`) that open the PDP.

> Live Claude calls aren't exercised in this environment (no key / no serverless in
> `vite preview`); the streaming client and the serverless function are written against
> the official `@anthropic-ai/sdk`, and the offline fallback is what the demo exercises.

### Catalogue data

The 25-scent catalogue is imported from the *Fragrance upload* spreadsheet — name,
inspiration, description, top/heart/base notes, and per-size prices (10 / 30 / 50 ml)
come straight from the sheet. The sheet omits a few fields the app needs, so:

- **gender** is assigned from the (well-known) inspiration reference — the sheet has
  no gender column, and inferring it from the description text is unreliable;
- **moq / committed** are deterministic demo batch values;
- **liquid / accent** swatch colours are derived from each scent's notes;
- **vipOnly** flags the single most expensive scent, so the VIP gate stays demoable.

Regenerate both `src/lib/data.ts` and `0002_seed.sql` from a new sheet with the
importer under `scripts/` (see below) to keep the live DB and offline seed identical.

### Applying the migrations

```bash
# Supabase CLI (from the project root)
supabase db push
# …or paste each file into the SQL editor in the Supabase dashboard, in order.
```

Then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`).
`src/lib/store.ts` loads live rows on mount — including up-to-date `committed`
counts — and records commits via the `commit_to_batch` RPC; if the vars are absent
or a request fails, it silently falls back to the seed catalogue so the app never
breaks. The anon key is browser-safe: RLS constrains every read and write.

> The migrations were validated end-to-end against PostgreSQL 16 — schema, seed,
> the committed-sync trigger, the VIP gate (both allow and reject), RPC return
> values, and idempotent re-seeding all verified.

### Stack

Vite + React 19 + TypeScript, `@supabase/supabase-js` for data. The design is a
desktop HTML/CSS comp, recreated with inline style objects (for pixel fidelity) plus
a small CSS layer for fonts, animations, hover states and responsive fallbacks.
