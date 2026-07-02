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
`localStorage`. Point it at a Supabase project (below) and the same UI reads and
writes live data instead, with the seed as an automatic fallback.

---

## What's implemented

Faithful to the redesign comp:

- **Header** — sticky, blurred; The Vault / The Method / VIP Club nav; commit
  counter; Sign In (auth modal) ↔ Account menu with the signed-in email + Sign Out.
- **Authentication** — real Supabase Auth: email/password + Google OAuth via an
  `AuthModal`; commits and VIP enrolment are tied to the signed-in user. Falls back
  to a local demo user when Supabase isn't configured.
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
│   └── store.ts           useFragrances() + recordCommit() — live data w/ seed fallback
└── components/
    ├── Header.tsx  Hero.tsx  Vault.tsx  FragranceCard.tsx
    ├── Method.tsx  VIP.tsx   ProductDetail.tsx  CommitDrawer.tsx
    ├── AuthModal.tsx  Footer.tsx  LayoutSwitch.tsx  Logo.tsx
public/assets/             Bottle imagery (hero portrait, PDP, pair, square)
supabase/
└── migrations/
    ├── 0001_init.sql      Schema, committed-sync trigger, commit_to_batch RPC, RLS
    └── 0002_seed.sql      Seed catalogue — 25 fragrances (mirrors src/lib/data.ts)
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
