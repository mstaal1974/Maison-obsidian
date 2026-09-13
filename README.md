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

**One fragrance. Multiple ways to experience it.** The fragrance is the master
product; every way of buying it — 10 ml Discovery, 30 ml Everyday Pour, 50 ml
Signature Pour, Car Diffuser, Body Wash, Moisturiser, the Complete Ritual set —
is a *format* (SKU) of that fragrance, not a separate listing.

- **Navigation** — `SHOP` (mega-menu: shop by fragrance / shop by format) ·
  `FRAGRANCES` · `DISCOVERY` · `CAR` · `BODY & SETS` · `FIND YOUR SCENT` ·
  `SCENT DNA`, plus a persistent search icon and **Your bag (n)**. Gender is a
  filter, not the architecture.
- **Homepage** — hero (*Wear it. Live it. Take it with you.*), the four ranges
  (Discover / Wear / Drive / Ritual), **Find your fragrance** (type a scent you
  love → your Maison Obsidian match with a % score), **Shop by mood** chips with
  horizontal scent cards, and the Obsidian Drive / Obsidian Ritual banners.
- **Fragrance world** (`#/fragrance/:slug`) — gallery, name → profile → "Inspired
  by the scent profile of …" (brand hierarchy reversed), experience icons,
  **Choose your format** in four groups (Wear it / Drive with it / Live in it /
  Complete the ritual) with *Coming soon · Notify me* for unlaunched formats,
  qty + Add to bag, engraving, the notes band, *Also available in …* and *You
  may also like*.
- **Quick view** — the format drawer ("How would you like it?") from any card, so
  nobody walks through five product pages to compare ways in.
- **Bag** — format-level lines, Drive cross-sell ("Love X? Take it with you"),
  *Reserve & authorise* checkout: each line becomes a commit (card authorised,
  never charged, until the batch pours).
- **Discovery** — 10 ml singles and the **Build your 5** Discovery Box.
- **Collections** — `#/shop`, `#/shop/:facet` (him / her / unisex / mood / format),
  `#/fragrances`, `#/car`, `#/body`, with gender · mood · format filter chips.
- **Admin product matrix** — fragrance × format grid: stock, launch status
  (live / coming soon / hidden) and price per cell, with bulk actions (enable car
  diffuser for all, mark / launch the body range, change a format's price for all).
  Bundles are intelligent: the Ritual's availability is the min of its parts.

### Discover Your Scent DNA (`/discover`)

A standalone campaign experience — its own chrome, no storefront navigation
required — built for social acquisition, lead generation and personalised
matching. Reachable at **`/discover`**, **`/scent-dna`** and, for a shared
result, **`/scent/<code>`** (clean paths rewritten to the app in `vercel.json`;
the hash forms `#/discover` and `#/scent/<code>` work identically).

`DISCOVER → SCENTPRINT → MATCH → SCENT UNIVERSE → EXPLORE`, with a four-step
progress rail (`01 Discover — 02 Scent DNA — 03 Matches — 04 Explore`).

- **Hero** — *What does your personality smell like?* over drifting vapour, a
  molecule lattice and an obsidian horizon, with an animated miniature
  Scentprint under the CTA so a visitor can see what they'll be given, and
  *Already have a Scentprint? → View My Profile* for the returning visitor.
- **The experience** — thirteen visual questions, opening with **who we are
  pouring for** (*For him* · *For her* · no preference), then seven scene /
  material choices that advance themselves (keys `1`–`4` work), three sliders
  (*Personal → Commanding*, *Dry → Sweet*, *Familiar → Adventurous*), a
  multi-select of occasions, and an optional searchable "a fragrance you
  already love".
- **Scentprint™** — sixteen scent dimensions scored 0–100 (fresh, citrus,
  aquatic, aromatic, green, floral, fruity, sweet, gourmand, spicy, woody,
  amber, musk, leather/smoky, powdery, clean) plus eight behavioural attributes
  (projection, longevity, sweetness, intensity, familiarity, adventurousness,
  day/night, casual/formal). Revealed on a timed build sequence, then drawn as a
  radar over a fingerprint motif — the strongest ten dimensions only, so it
  stays a shape rather than a chart.
- **Shareable card** — the result rendered to a 1080 × 1350 canvas (the
  Instagram portrait), offered through the native Share sheet where the browser
  has one, plus **Download my Scentprint** and **Copy link**.
- **Matching engine** — every fragrance carries its own Scentprint, derived from
  its notes, so a scent added by an admin is matched without anyone filling in a
  sheet. Compatibility is a *weighted* similarity: the dimensions the customer
  actually cares about dominate, a fragrance loud in something they never reach
  for is punished harder than one that is merely quiet, and sweetness,
  intensity, projection and the chosen occasions are scored on top.
- **The shelf** — the opening answer decides which bottles come back: masculine
  + unisex for him (32 of the 53), feminine + unisex for her (35), everything
  when no preference is given. It filters the catalogue and nothing else — the
  Scentprint is built from what the person actually chose, so two people who
  answer the questions identically get the same profile and a different shelf.
  Matches, the Scent Universe and the share card all read the same filter, and a
  chip row on the matches section switches shelf in place rather than making
  anyone retake the experience.
- **Scent Universe™** — the customer at the centre, the whole house placed
  around them: distance is compatibility, bearing is the fragrance's own family
  on a wheel that runs fresh (north) through sweet, amber and leather to woody
  (south) and back up through green, floral and clean. Family lenses, a detail
  panel with *View fragrance* / *Add 10 ml*, and the same data as a ranked list
  underneath for anyone without a pointer.
- **Explore** — email capture (*have your Scentprint sent to you*) with a
  separate, unticked marketing consent, *Shop your closest match*, *Build my
  5-scent discovery set* (drops the top five into the bag as a Discovery Box)
  and *Retake*.

### The AI layer

Six capabilities behind **one** serverless route (`api/scent-ai.ts`) — one
because Vercel's function budget was at eleven of twelve, and because all six
want the same prompt prefix. The house voice, the Scentprint vocabulary and the
catalogue (with the numbers our own engine derived) sit above a single cache
breakpoint, so a visitor moving from the conversation to their matches to a
curated set reads the catalogue once rather than five times.

**The rule the whole layer is built on:** the deterministic engine in
`lib/scentdna.ts` computes the Scentprint and every compatibility score. The
model never scores anything. It is handed numbers and puts them into language,
or it proposes adjustments that are applied through that same engine. That is
what keeps "94% match" true rather than merely plausible — and it is why every
capability still works with no API key at all.

| | What it does | Without a key |
| --- | --- | --- |
| **Conversational discovery** | A chat that asks about places, weather and food — never notes or families — and fills the Scentprint in beside it as you answer | A scripted five-question ladder, read through the same note lexicon |
| **Learning Scentprint** | Every sample worn and every "too sweet" moves the profile; the original answers are kept so it can be explained or unwound | Keyword rules for the things people actually say, merged identically |
| **Match explanation** | Why this one, citing the dimensions you share and the one that pulls against you | The engine's own sentence, which is what the cards already showed |
| **AI discovery set** | Five that cover where you live rather than the five highest scores, each with what it's for | Greedy diversity pick: closest match, then whichever strong candidate smells least like those chosen |
| **Memory / image → scent** | A photograph or a described moment read as a Scentprint, with a title and story for the share card | The note lexicon over the written memory; photographs need the model |
| **Familiar ↔ Adventurous** | An appetite control that changes which scents the Scent Universe argues for, each labelled with what it keeps and what it changes | Aims at a compatibility band below their best match rather than the top of the list |

Model: `claude-opus-5`, structured outputs (`output_config.format`) so every
answer arrives schema-valid, effort tuned per operation, and the server-side
refusal fallback to `claude-opus-4-8` that the conception route already uses.
Anything the model returns naming a fragrance we didn't ask about is dropped
before it reaches the page.

Structured outputs accept only a [subset of JSON
Schema](https://platform.claude.com/docs/en/build-with-claude/structured-outputs):
`minimum`, `maximum`, `maxItems`, `minLength` and `pattern` are rejected with a
400 at request time, which nothing local catches — and the client's fallbacks
hide it, so the site looks fine while no model is ever reached. Bounds are
stated in each field's `description` and the values are clamped on arrival.
`npm run check:schemas` (also part of `npm run build`, so Vercel can't deploy
past it) checks every schema in `api/` against that subset.

The learning store is `scent_signals` (migration 0024): one row per signal,
keyed by share code and, when signed in, by account. The profile shown is
always the original print with the signals applied on top — weighted by kind
(buying a bottle counts for more than bagging a sample, passing counts for
less) and faded on a 240-day half-life.

Privacy: a share code carries numbers only — never a name or an email. With
Supabase configured the result is stored and a six-character code minted
(`…/scent/7HD92K`); without it the whole Scentprint is encoded into the code so
the link still opens on any device. An email is attached to the stored profile
only when the visitor asks for it, and express consent to marketing is recorded
separately, exactly as the footer signup does.

### Imagery from the design comp

The layouts reference the comp's photography by path; until those files are
dropped into `public/assets/` the stock bottle shots stand in (vignetted to sit
on the dark theme). Add these to match the comp exactly:

| Path | Used by |
| --- | --- |
| `assets/hero-lineup.jpg` | Homepage hero — 50 ml, 30 ml, discovery, car diffuser, wash, moisturiser |
| `assets/10-ml-bottles-Remix-1.jpg`, `30 ml bottle.jpeg`, `car-freshner.jpg`, `body and sets.jpg` | "Choose your Obsidian" tiles (in place) |
| `assets/banner-drive.jpg` / `banner-ritual.jpg` | Drive / Ritual banners and the Car / Body page headers |
| per-fragrance transparent PNG | Uploaded from the admin console (tiles, product page, bag) |

Earlier foundations, still in place:

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
- **AI fragrance conception** (admin) — type a reference fragrance and Claude proposes
  the Maison Obsidian name (**Brand Conception**), writes tagline, story and packaging
  copy (**Copywriting**), and deconstructs the scent into top / heart / base notes
  (**Olfactory Breakdown**). Attach a transparent bottle PNG (or keep the placeholder)
  and add the product in one click; everything lands in the regular editor for tweaks.
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
- **The Method** — the four movements (Source → Macerate → Commit → Pour), now on
  the `#/about` page with the range nomenclature and the VIP Club.
- **VIP Club** — email enrolment that writes to the `subscribers` table (via the
  `enroll_subscriber` RPC) and unlocks VIP-only batches.
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
│   ├── conceive.ts        AI conception client, PNG inspection, bottle image upload
│   ├── formats.ts         Format/SKU model, moods, experience tags, find-my-match scoring
│   ├── scentdna.ts        Scentprint™ model, note→dimension lexicon, matching engine, Scent Universe™
│   ├── scentQuiz.ts       The thirteen discovery questions and their weights → a Scentprint
│   ├── scentShare.ts      Share codes, local persistence, lead capture
│   ├── scentai.ts         The six AI capabilities + a local fallback for each
│   ├── scentLearning.ts   Signals, the merge maths, and what changed
│   ├── bag.ts             Bag lines, orders, Discovery Box picks (localStorage store)
│   ├── route.ts           Hash router + path helpers
│   ├── concierge.ts       Chatbot: catalogue summary, streaming client, offline fallback
│   └── store.ts           useFragrances() + recordCommit() + fetch{MyCommits,MyShipments}()
└── components/
    ├── Header.tsx  Hero.tsx  ChooseObsidian.tsx  FindYourScent.tsx  MoodShop.tsx  RangeBanners.tsx
    ├── Collection.tsx  Discovery.tsx  About.tsx  FragranceCard.tsx  ScentCard.tsx
    ├── ProductDetail.tsx  QuickView.tsx  BagDrawer.tsx  FormatMatrix.tsx
    ├── Method.tsx  VIP.tsx  ui.tsx  styles.ts
    ├── AuthModal.tsx  MyReservations.tsx  AdminConsole.tsx  ChatWidget.tsx
    ├── ConceiveFragrance.tsx  BottleImage.tsx  adminStyles.ts
    ├── Footer.tsx  LayoutSwitch.tsx  Logo.tsx
    ├── ScentDna.tsx                  /discover — hero, experience, reveal, result
    └── scent/
        ├── Atmosphere.tsx            Vapour, molecule lattice, obsidian horizon
        ├── DiscoverQuiz.tsx          The thirteen questions
        ├── Glyph.tsx                 Abstract line art for the answer cards
        ├── ScentprintRing.tsx        The radar over the fingerprint motif
        ├── ScentUniverse.tsx         The interactive map + the appetite control
        ├── ScentConversation.tsx     Discovery as a conversation
        ├── ScentMemory.tsx           A photograph or a memory → a Scentprint
        ├── ScentResult.tsx           Scentprint · matches · universe · explore
        ├── ShareCard.tsx             1080 × 1350 canvas card + Share / Download / Copy
        └── theme.ts                  Palette and surfaces for the experience
api/
├── chat.ts                Vercel serverless proxy → Claude (streams the concierge reply)
├── scent-ai.ts            The Scent DNA AI layer — six operations, one cached prefix
└── conceive.ts            Vercel serverless → Claude structured output (AI fragrance conception)
public/assets/             Bottle imagery (hero portrait, PDP, pair, square)
supabase/
├── migrations/
│   ├── 0001_init.sql            Schema, committed-sync trigger, commit_to_batch RPC, RLS
│   ├── 0002_seed.sql            Seed catalogue — the original 25 (mirrors src/lib/data.ts)
│   ├── 0003_admin_inventory.sql admins + is_admin(), stock columns, fragrance CRUD RPCs
│   ├── 0004_shipments.sql       shipments table, RLS, admin fulfillment RPCs
│   ├── 0005_chat.sql            concierge transcripts + log_chat_message RPC, RLS
│   ├── 0006_oil_inventory.sql   oil_ml + admin_set_oil; commit_size_counts (per-size demand)
│   ├── 0007_reconcile_committed.sql  committed recomputed from real rows; batch = per-size sum
│   ├── 0008_ai_conception.sql   image_url + profile columns, fragrance-images bucket, upsert RPC
│   ├── 0009_formats.sql         format_prices/format_status + car/wash/moist stock, commits.format, admin_set_formats
│   ├── 0010–0018                scent requests · JPEG renders · subscriptions · profiles & consent · Stripe · delivery · guest orders
│   ├── 0019_scent_dna.sql       scent_profiles + save_scentprint / get_scentprint / attach_scentprint_email
│   ├── 0020_scent_dna_wearer.sql  scent_profiles.wearer (him / her / all) carried through both RPCs
│   ├── 0021_audience_catalogue.sql  +32 scents with a Him/Her/Unisex audience; retires the 4 superseded
│   ├── 0022_bottle_photography.sql  image_url for all 53 scents
│   ├── 0023_boss_reference.sql      one inspiration reference written without its separator
│   └── 0024_scent_signals.sql       scent_signals + record_scent_signal / scent_signals_for
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
| `fragrances` | Catalogue (53 scents); columns mirror the `Fragrance` type 1:1, with per-size pricing (`price_10ml_cents` / `_30ml_` / `_50ml_`). Public read. |
| `commits` | Batch reservations (engraving, chosen `size_ml` + `charge_cents`, `authorized`/`captured`/`released`/`void`, optional `payment_intent_id`). Anyone may insert; users read their own. |
| `subscribers` | General list + `vip` tier (gates VIP-only batches). |
| `scent_profiles` | Scentprints from `/discover`, keyed by a six-character share code: the sixteen dimensions, the eight behavioural attributes, the occasions chosen, the shelf (`wearer`), and an email only when the visitor asked for their result. Read through `get_scentprint` (which never returns the email); customers read their own rows, admins read all. |
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

`0007_reconcile_committed.sql` makes the batch progress number and the per-size panel
agree. Both now derive from real rows in `commits`: the sync trigger counts a spot as
held only while a commit is `authorized`/`captured` (releasing or voiding frees it),
and the migration recomputes `fragrances.committed` from those rows — discarding the
static launch numbers seeded in `0002`. So `committed` always equals the sum of the
per-size counts. (Before this, the seed pre-set e.g. `committed = 21` with no backing
commit rows, so the batch bar read 21/30 while every per-size count showed 0.)

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

### The bag through Stripe

`recordOrder` needs the internal fragrance id, format, engraving and unit price
for each bag line — none of which Stripe's own line items carry — so the bag
travels as session metadata. Stripe caps a metadata **value** at 500 characters,
and the bag used to be written as one value truncated to 490. Any order past
about eight lines was cut mid-object: `JSON.parse` threw in the webhook, the
delivery answered `handler failed`, and a **paid order was never recorded**.
Resending did not help, because the truncation happened when the session was
created.

The bag is now split across numbered keys — `lines`, `lines2`, `lines3` … —
by `chunkBag()` and joined back by `recordOrder`. Twenty chunks of 460
characters is about 180 bag lines; beyond that `bagFits()` refuses the checkout
**before** taking payment rather than recording something incomplete after.

Sessions created before the fix are still recoverable: when the joined metadata
will not parse, `recordOrder` rebuilds the lines from what Stripe did keep — the
product name on each line item, which is `${fragrance} — ${format}` — matching
the name back to the catalogue and reading the engraving out of the product
description. Shipping and anything unrecognised are skipped. So a failed
delivery from that era can simply be resent, or the session opened at
`/api/stripe/confirm?session_id=cs_…`; `recordOrder` is keyed on the checkout
session and no-ops if the order is already there.

### The staff order desk (`/staff`)

A paid order is several rows in `commits` that share a Stripe checkout session;
packing is a per-order act, so `0025_staff_desk.sql` adds `order_fulfilment`
keyed by that session — `packed`, `packed_at`, `tracking_number`, `shipped_at`.

The desk is used by whoever is packing, who may have no account, so it opens
with a **shared passphrase** rather than a login. The passphrase is bcrypt-hashed
in `staff_access` and checked inside three `SECURITY DEFINER` functions —
`staff_orders`, `staff_set_packed`, `staff_set_tracking` — which are the only way
in: both tables have RLS on with **no policies at all**, so nothing is readable
through PostgREST without it. An `is_admin()` session passes without a
passphrase. A wrong one costs a `pg_sleep(0.4)`, enough friction that guessing
through the anon key is not worth starting.

Set the passphrase before anyone else has the URL:

```sql
select public.admin_set_staff_passphrase('a passphrase you choose');
-- or, straight from the SQL editor:
update public.staff_access set passphrase_hash = crypt('…', gen_salt('bf'));
```

It deliberately uses no serverless function — the project sits at Vercel's
twelve-function ceiling — so the whole desk is RPCs plus a page.

The page (`/staff`, or `#/staff`) shows each paid order with its lines, the
reference each scent interprets, the amount, the customer, the shipping address
and any delivery note, a **tick box for packed**, and a field for the **Australia
Post article id** (saved on blur, with a tracking link once set). Filters cover
*to pack*, *no tracking*, *packed* and *all*; there is a search box and a CSV
export. The passphrase lives in `sessionStorage`, so closing the tab locks it.

Two print sheets live in the page, hidden on screen, and a `data-print` mark on
`<body>` chooses which one the printer sees — built in the page rather than a
popup, which browsers block:

- **Pack list** — one bordered block per order that never splits across a page,
  with a tick box and quantity per line, the engraving, the address and the
  delivery note.
- **Labels** — A6 address labels, one per page, with the sender block, the
  recipient, the order ref, the piece count and the tracking number.

The sender block comes from `VITE_RETURN_ADDRESS` (lines separated by `|`).
Nothing is guessed: unset, the label prints a warning instead of an address,
because a plausible wrong return address is how an undelivered parcel stops
coming back.

> These are address labels, not prepaid postage. A real Australia Post label
> carries a barcode that AusPost issues against a lodged consignment — that needs
> a MyPost Business or eParcel account and their Shipping & Tracking API, which
> can be wired to this desk when those credentials exist.

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

### AI fragrance conception (admin)

**Conceive with AI** in the admin console's Catalogue tab turns a reference fragrance
name into a ready-to-publish catalogue entry. `ConceiveFragrance` POSTs the reference
(plus an optional brief and the existing house names, so nothing collides) to
**`api/conceive.ts`**, which asks `claude-opus-5` for a JSON conception constrained by a
**structured-output schema** — house name + three alternates, three-word scent profile,
family, gender positioning, "Inspired by Brand - Fragrance" attribution, tagline,
one-line story, 60–90 words of packaging copy, top / heart / base notes, juice and
accent colours, and experience tags. The result renders as three panels:

1. **Brand Conception** — editable name, alternates as one-click chips, profile,
   family / gender, attribution.
2. **Copywriting** — tagline, story, packaging copy.
3. **Olfactory Breakdown** — top / heart / base chips, colour swatches, experience tags.

Below them a drop zone takes a **transparent PNG** of the bottle (validated by header:
signature, dimensions, alpha channel / tRNS; 4 MB cap). **Add to catalogue** uploads the
PNG to the public `fragrance-images` bucket (`0008_ai_conception.sql`; admins-only
writes via `is_admin()`), then upserts the fragrance with `image_url` and `profile`.
Prices default to the catalogue medians and stock starts at zero. **Refine in editor**
opens the same draft (PNG included) in the regular editor, which also gained the image
field and the profile field for existing scents.

Uploaded renders replace the stock photography on the Vault tile and the product page,
sitting on a backdrop tinted with the scent's liquid and accent colours (`BottleImage`).
Without an image the placeholder bottle photography is used as before.

Guard rails: when Supabase is configured the endpoint requires a Supabase access
token that passes `is_admin()` (401/403 otherwise); it's rate-limited to 10/min per IP;
refusals return 422 and are surfaced in the panel. It needs `ANTHROPIC_API_KEY` on the
server — in the offline demo (Vite alone, no serverless) the panel explains that and
the manual **+ Add Fragrance** path still works, with the PNG inlined as a data URL.

### Concierge chatbot (Claude)

A floating concierge (`ChatWidget`) answers questions about the house and recommends
scents. It talks to Claude through **`api/chat.ts`**, a Vercel serverless function that
holds `ANTHROPIC_API_KEY` server-side and streams the reply back as plain text — the key
never reaches the browser. The client sends the conversation plus a compact **live
catalogue summary** (`concierge.ts`), and the function prepends a house system prompt
(brand voice, batch model, sizes, engraving, VIP, Australia Post shipping) and streams
`claude-opus-4-8`.

Set `ANTHROPIC_API_KEY` in the Vercel project (Settings → Environment Variables); every
AI route also accepts the shorter `ANTHROPIC_KEY`, so either name works. When
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

The 53-scent catalogue comes from two sheets:

- the original *Fragrance upload* sheet — name, inspiration, description,
  top/heart/base notes and per-size prices (10 / 30 / 50 ml);
- the *Fragrance Audience* sheet (2026), which added 32 scents **with an explicit
  Him / Her / Unisex audience column** — the one `/discover` reads to decide whose
  shelf a fragrance sits on.

Four of the originals were retired when the audience sheet arrived, each a
different edition of a fragrance the new sheet already carries: Fiery Spice
(Spicebomb Extreme) → **Midnight Spice Noir** (Dark Leather), Imperial Vintage
(Aventus Absolu) → **Ventus** (Aventus), Fierce Amber → **Infinite Devotion**
(both Armani *Stronger With You Intensely*), and Shadowed Oud (Oud Wood Intense)
→ **Smoky Timber** (Oud Wood).

Neither sheet carries every field the app needs, so:

- **gender** is the audience sheet's Him / Her / Unisex column for the 32; the
  original scents keep the reading assigned from their inspiration reference,
  which is where the sheet had no gender column at all;
- **price** — the audience sheet has no prices, so its 32 are flat across the
  range at $21 / $34 / $47; the original scents keep their own pricing;
- **moq / committed** are deterministic demo batch values;
- **liquid / accent** swatch colours are derived from each scent's notes by the
  same lexicon the matching engine reads (`lib/scentdna.ts`), so a card's colour
  and its Scentprint never disagree;
- **vipOnly** flags the single most expensive scent, so the VIP gate stays demoable.

**Bottle photography.** Every scent has a 1024 × 1024 house shot
in `public/assets`, uploaded under the *inspiration reference* it was styled for
rather than the house slug — so `imageUrl` is set explicitly on each scent
(and in migration 0021's companion, `0022`) instead of relying on the
`/assets/<slug>.png` convention in `bottleImageFor()`. Paths are percent-encoded
because the filenames carry spaces and em-dashes.

Two things to know when adding more:

- **avoid `&` in a filename.** The dev server answers `/assets/…%26….jpg` with a
  200 and the HTML shell rather than the image, so the page silently falls back
  to the stock bottle with nothing in the console. `Creed — Spice & Wood.jpg`
  was renamed to `… Spice and Wood.jpg` for exactly this reason. Spaces and
  em-dashes are fine.
- **Midnight Berry Noir** (Burberry *Her Intense*) has no shot of its own and
  shares the Burberry *Her* one with London Berry Blossom — the same fragrance
  line, one flanker apart. It is the only image used by two scents.

Where a reference has more than one upload, the one in use is recorded in
`imageUrl`; the spares stay in the folder untouched.

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
> values, and idempotent re-seeding all verified. `0025_staff_desk.sql` was
> validated the same way: every migration applied in order against PostgreSQL 16,
> then the desk's own behaviour exercised — orders grouped by checkout session
> (with a payment-intent fallback for rows that predate sessions), unpaid rows
> excluded, totals summed across lines, a wrong passphrase refused on both reads
> and writes, and packed/tracking set and cleared.

### Stack

Vite + React 19 + TypeScript, `@supabase/supabase-js` for data. The design is a
desktop HTML/CSS comp, recreated with inline style objects (for pixel fidelity) plus
a small CSS layer for fonts, animations, hover states and responsive fallbacks.
