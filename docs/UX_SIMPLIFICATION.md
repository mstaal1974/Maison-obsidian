# UX simplification — what this branch implements

Principle: **simplify the decision, not the catalogue.** Nothing was removed from
the store; capabilities now appear in the order a shopper needs them. Every
existing route still works.

## Header (Phase 1)
- Five primary choices: **Shop · Find My Scent · Discovery Sets · Gifts · Our House**.
- Shop mega-menu holds the rest: all fragrances, new arrivals, 10/30/50 ml, car
  diffusers, body & bath, sets, subscribe & save, plus fragrance families.
- Search icon opens a universal search overlay: our fragrances (name, profile,
  notes) and "find an equivalent" (the matcher) in one place.
- Phone drawer uses the same five-item hierarchy; Shop expands in place.
- Search and drawer trap focus, close on Escape and return focus (`useDialog`).

## Homepage (Phase 1) — five blocks
1. Focused hero: one primary CTA, one secondary link, one trust line.
2. "How would you like to choose?" — match a fragrance / Scent DNA / Discovery Box.
3. Four featured scents with simplified cards (one action: Choose size).
4. "Make it part of your day" (the four range tiles, renamed).
5. Factual trust block (samples, free post over $100, 30-day returns, secure guest checkout).

Moved, not deleted: Shop by Mood → /find; range banners → /fragrances;
Monthly Pour band → thank-you page (after a paid order); Just Poured → /new;
the full matcher stays on /find.

**Featured, not "Best sellers":** there is no sales data yet, so the row is a
curated "Signature scents" list. Set `FEATURED_SLUGS` and `FEATURED_FROM_SALES`
in `src/lib/merchandising.ts` once real ranking exists and the labels switch to
"Best sellers".

## Collections
- Filters are progressive: For + five scent families up front, More filters for
  the other moods, format, new and "inspired by".
- Applied filters are removable chips with Clear all; the result count is live.
- On phones the filter bar is sticky.
- `/shop/gifts` is a gifts landing page (Discovery Box or an engraved 50 ml).
- Price filter omitted: every fragrance is on the same house price list.

## Product cards
Image, one factual badge (New or VIP), name, three-word profile, occasion,
"From" price, one action. Notes, inspiration and formats moved to quick view
and the product page. The Discovery Box toggle only appears on /discovery.

## Product page (Phase 2)
- Above the fold: name, profile, rating (if reviews exist), one-sentence
  description, three sizes (10 ml Try it · 30 ml Everyday · 50 ml Signature),
  add to bag with price, availability, free-post and returns reassurance.
- Defaults to 30 ml (`?format=` links still open on their format).
- Car and body formats collapse under "Also available for car and body";
  coming-soon formats under their own collapsed panel with Notify me.
- Notes, How it wears, Inspiration, Delivery & returns are accordions.
- Add-ons (same scent in the car/body, closest 10 ml) come after the purchase
  area as individual Add buttons instead of pre-purchase checkboxes.
- Mobile sticky purchase bar keeps the selected size and price.
- Removed the non-functional wishlist button.

## Bag & checkout
- Bag lines show "Ready to ship" or "Filled to order"; one cross-sell kept;
  duplicate reassurance trimmed; focus trapped in the drawer.
- Checkout shows Details → Delivery → Payment, validates fields inline on blur,
  and collapses the order summary on phones. Guest checkout, the unticked
  reminder and cancelled-payment messaging are unchanged.
- Not done: address autocomplete (needs a provider), discount codes (none exist).

## Analytics (Phase 0 events)
Added: `view_item_list`, `view_cart`, `remove_from_cart`, `add_shipping_info`,
`search`, `quiz_start`, `quiz_step`, `quiz_complete`, `format_selected`,
`subscription_offer_viewed`, `subscription_started`. `add_payment_info` is not
sent: card entry happens on Stripe's hosted page.

## Not in this branch (Phases 3–4)
Discovery-to-full-size credit, fixed bundles, replenishment and lifecycle
email, structured review dimensions, personalised ordering, and experiments —
these need backend, email and data work beyond the storefront UI.
