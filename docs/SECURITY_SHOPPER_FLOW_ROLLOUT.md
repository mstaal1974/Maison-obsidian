# Security and shopper-flow branch

This branch is for review. It does not apply a live database migration, change
staff membership, configure payment services, or publish the Sites preview.

## Deployment sequence

1. Test `0029_checkout_security.sql` on a staging copy with migrations 0001–0028
   already applied. Back up production before applying it there. This migration
   removes public writes and legacy client-side billing, switches the staff desk
   to account membership, and adds the atomic paid-order RPC. Do not restore
   public order writes as a rollback shortcut.
2. Create individual Supabase Auth accounts for fulfilment staff. Add only their
   verified user IDs to `public.staff_members` using the database console or a
   service-role administration process. Existing admins retain staff access.
   Remove membership when a staff member leaves. Shared passwords no longer work.
3. Apply the migration before deploying this branch's server handlers. Deploy
   the staff UI and checkout code together. The previous direct server insert
   path remains privileged, but older staff password clients cease working.
4. Configure Stripe, Supabase and Australia Post, plus an explicit `SITE_URL`.
   Include `checkout.session.async_payment_succeeded` with existing webhook events.
   Orders are recorded only after `payment_status` is `paid`.
5. Configure verified `VITE_SUPPORT_EMAIL`, `VITE_PRIVACY_POLICY_URL` and
   `VITE_RETURNS_POLICY_URL` before public launch. Policy URLs must be HTTPS.
   The help page discloses missing policies instead of inventing terms.
6. Exercise Stripe test-mode checkout, cancellation, delayed payment, guest and
   member orders, full and mixed discovery boxes, failed postage quotes, and
   20-line baskets. Deliver a webhook and confirmation concurrently; assert one
   set of rows and one `processed_checkout_sessions` marker. Replay both.
7. Test database access using anonymous, ordinary customer, staff and admin roles:
   clients cannot insert orders or call `record_paid_order`; ordinary customers
   cannot read staff orders; staff can pack and track but cannot administer stock.
   Failed row inserts must roll back the marker and permit a successful retry.
8. Verify mobile checkout, keyboard navigation, enlarged text and real support
   links before public release.

## Automated checks

- `npm run test:security`: uses actual server modules with local test doubles;
  covers discounted-format isolation, complete bundles, strict quantities,
  unchanged regular pricing, multi-chunk basket parsing, payment-status gating,
  and atomic-RPC error propagation. No external services are called.
- `npx tsc -p tsconfig.api.json --noEmit`: checks server TypeScript.
- `npm run build`: checks frontend TypeScript, AI output schemas and bundle build.

The database migration and Stripe integration require staging verification;
local regression checks do not prove production database grants or concurrency.
The earlier browser review was blocked by the review environment.

## Data preservation

The migration preserves existing orders, including any historical duplicates.
The per-session transaction lock and unique marker protect new handler replays;
existing sessions with order rows are adopted without reinserting their lines.
Inspect any suspected historical duplicates manually before reconciliation.
Historical staff seed migrations now generate unknown random values rather than
ship a usable default password. Migration 0029 ignores all stored password hashes.
