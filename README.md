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

No backend is required — the catalogue, batch counters, gender filters, engraving
preview, commit flow, VIP enrolment and commit drawer all run client-side against
the seed data in `src/lib/data.ts`. Commits persist to `localStorage`.

---

## What's implemented

Faithful to the redesign comp:

- **Header** — sticky, blurred; The Vault / The Method / VIP Club nav; commit
  counter; Sign In ↔ Account toggle.
- **Hero** — atmospheric landing with the four brand stats (30% · 4wk · 20 · DXB).
- **The Vault** — catalogue with **All / For Him / For Her** tabs and two layouts a
  floating switch toggles between: **Gallery** (liquid-swatch cards) and **Ledger**
  (dense table). Each entry shows live `committed / moq` progress and VIP / Batch-Met
  badges.
- **Product detail** — hash-routed at `#/fragrance/:slug`; story, composition
  (top / heart / base), stats, the **Custom Engraving engine** with a live label
  preview, and the batch progress + *Commit to this Batch* CTA.
- **The Method** — the four movements (Source → Macerate → Commit → Pour).
- **VIP Club** — membership panel with join state.
- **Commit drawer** — slide-out confirming the reserved batch, engraving, and the
  authorize-not-charge promise.
- **Footer** + film-grain overlay, responsive breakpoints, and reduced-motion support.

## Architecture

```
index.html                 Fonts (Cormorant Garamond · Hanken Grotesk · Space Mono), meta
src/
├── main.tsx               Entry — mounts <App>, imports index.css
├── index.css              Base tokens, grain overlay, keyframes, hover states, breakpoints
├── App.tsx                State + hash-routing shell (home ⇄ product), commit persistence
├── lib/
│   └── data.ts            Fragrance type, seed catalogue, design tokens, helpers
└── components/
    ├── Header.tsx  Hero.tsx  Vault.tsx  FragranceCard.tsx
    ├── Method.tsx  VIP.tsx   ProductDetail.tsx  CommitDrawer.tsx
    ├── Footer.tsx  LayoutSwitch.tsx  Logo.tsx
public/assets/             Bottle imagery (hero portrait, PDP, pair, square)
```

### The batch model

Each fragrance carries an `moq` (minimum order quantity) and a seeded `committed`
count. Committing to a batch adds the customer's reservation on top of the seed and
opens the drawer. When `committed >= moq` the card/PDP show **Batch Met**. In a
production build this is where the authorize-later Stripe intent would be captured
and the admin notified.

### Stack

Vite + React 19 + TypeScript. The design is a desktop HTML/CSS comp, recreated with
inline style objects (for pixel fidelity) plus a small CSS layer for fonts,
animations, hover states and responsive fallbacks.
