# Analytics & Search Console

The site ships with Google Analytics 4 and Search Console support. Both stay
off until you give them an ID in Vercel, so local development and preview
deployments send nothing.

## 1. Google Analytics 4

1. Go to <https://analytics.google.com> → **Admin** → **Create** → **Property**.
   Name it *Maison Obsidian*, time zone *Australia*, currency *AUD*.
2. Choose **Web** as the platform, enter `https://maisonobsidian.com.au`, and
   create the stream. Copy the **Measurement ID** (`G-…`).
3. Vercel → your project → **Settings → Environment Variables**, add
   `VITE_GA_MEASUREMENT_ID` = `G-…` for **Production** only.
4. **Redeploy** (Deployments → ⋯ → Redeploy). The ID is baked in at build time,
   so it has no effect until the next build.
5. Check it: open the live site, then GA → **Reports → Realtime**. You should
   appear within a minute.

In GA → **Admin → Data streams → your stream → Enhanced measurement**, turn
**Page changes based on browser history events** *off*. The site sends its own
page views on every screen change, and leaving this on would count each one twice.

### What is tracked

| Event | When |
| --- | --- |
| `page_view` | Every storefront screen (admin, staff and account screens are not tracked; query strings are dropped except `utm_*` tags and ad click ids, so tagged social and ad links are attributed) |
| `view_item` | A fragrance page is opened |
| `select_item` | A fragrance is opened from a product card |
| `add_to_cart` | Anything goes in the bag (product page, quick view, Discovery Box, car diffuser, Scent DNA sample) |
| `begin_checkout` | The customer continues to payment |
| `purchase` | A paid order is confirmed on the thank-you page, with its total and items |
| `discovery_box_completed` | A full Discovery Box goes into the bag |
| `scent_match_completed` | A Scent DNA result is revealed (`method`: quiz, conversation or memory — never the answers) |
| `car_diffuser_attach` | A car diffuser goes into a bag that already holds a perfume |

Tag every social post and ad link, e.g.
`/discovery?utm_source=instagram&utm_medium=social&utm_campaign=discovery-box&utm_content=reel-01`,
so sessions and purchases can be compared per post and creative.

In GA → **Admin → Events** (after the first purchase has come through), mark `purchase` as a **key event**.
Revenue then shows under **Reports → Monetisation**.

### Privacy

GA4 sets cookies and does not log IP addresses. Add a line to the privacy
policy (`VITE_PRIVACY_POLICY_URL`) saying the site uses Google Analytics to
understand how it is used, with a link to <https://policies.google.com/privacy>.

## 2. Google Search Console

**Recommended: a Domain property verified by DNS.** It covers every address
(`www`, no `www`, `http`, `https`) and doesn't depend on the site's code.

1. <https://search.google.com/search-console> → **Add property** → **Domain** →
   `maisonobsidian.com.au`.
2. Copy the `google-site-verification=…` TXT record it shows.
3. Add it as a **TXT** record at your domain's DNS provider (wherever
   maisonobsidian.com.au is managed: Vercel → Domains, or your registrar), host `@`.
4. Back in Search Console, click **Verify**. DNS can take a few minutes, and
   occasionally a few hours.

**Alternative: an HTML tag** (a *URL prefix* property, if you can't change DNS):

1. **Add property** → **URL prefix** → `https://maisonobsidian.com.au`.
2. Choose **HTML tag**. It gives
   `<meta name="google-site-verification" content="XXXX" />`.
3. In Vercel set `GOOGLE_SITE_VERIFICATION` = `XXXX` (just the content value),
   redeploy, then click **Verify**.

### After verifying

1. **Sitemaps** → submit `sitemap.xml`. It is rebuilt on every deploy with the home
   page, the shop pages and one page per launched fragrance. Set `VITE_SITE_URL`
   to the canonical host (`https://www.…` if the bare domain redirects to www)
   so the sitemap, canonical tags and structured data all name it.
2. **URL inspection** → paste a fragrance URL → **Request indexing** for the
   handful of pages that matter most.
3. Link it to Analytics: GA → **Admin → Product links → Search Console links**.
   Search queries then show up inside GA too.

Expect data to start showing in Search Console after 2–3 days.

## 3. Google Merchant Center

Every deploy writes `/merchant-feed.xml`: one item per purchasable SKU (each
eau de parfum size and the car diffuser) with its price, availability and a
link that opens the product page on that SKU (`?format=10ml`, `?format=car`).
The product pages carry matching `ProductGroup` / `Offer` structured data.

1. Merchant Center → **Products → Add products → Add from a file** → **Scheduled
   fetch**, URL `https://<your host>/merchant-feed.xml`, daily. Prices come from
   the catalogue at build time, so redeploy (or let the daily fetch pick up the
   next deploy) after changing prices.
2. **Shipping and returns**: set postage as a shipping service (Australia Post,
   free standard post over $100) and the returns policy in Merchant Center; the
   feed leaves both out rather than guess a flat rate.
3. Check **Diagnostics** before any paid Shopping test. Titles and descriptions
   deliberately leave out the "inspired by" designer names — review that
   wording against Google's counterfeit-goods policy before adding it.

## 4. Meta Pixel (Facebook & Instagram ads)

1. Vercel → your project → **Settings → Environment Variables**, add
   `VITE_META_PIXEL_ID` = your Pixel ID (the number from Meta Events Manager →
   **Data sources**) for **Production** only.
2. **Redeploy**. Like the GA ID, it is baked in at build time.
3. Check it: Events Manager → your pixel → **Test events**, enter the site's
   address and browse; or install the *Meta Pixel Helper* Chrome extension.

### What is sent

| Meta event | When (same moment as the GA event) |
| --- | --- |
| `PageView` | Every storefront screen (not admin, staff or account) |
| `ViewContent` | A fragrance page is opened |
| `AddToCart` | Anything goes in the bag |
| `InitiateCheckout` | The customer continues to payment |
| `AddPaymentInfo` | The checkout form is complete and hands over to Stripe |
| `Purchase` | A paid order is confirmed, with its total; the Stripe session id is the event id, so a refresh isn't counted twice |
| `Search` | A search in the header search or the fragrance matcher |
| `Subscribe` | A Monthly Pour is confirmed as paid |

In Events Manager → **Settings**, turn on **Automatic advanced matching** only
if your privacy policy covers it. Under **Aggregated event measurement** (or
*Web event configuration*), rank `Purchase` first, then `InitiateCheckout`,
`AddToCart`, `ViewContent`.

### Privacy

The pixel sets cookies and sends browsing activity to Meta. Add a line to the
privacy policy saying the site uses the Meta Pixel to measure and personalise
advertising, with a link to <https://www.facebook.com/privacy/policy>.

## 5. The house's own analytics (Admin → Analytics)

Heatmaps, customer journeys, the purchase funnel and page reports, recorded in
your own Supabase database — no third party.

1. Apply `supabase/migrations/0036_site_analytics.sql` (Supabase → SQL editor,
   or `supabase db push`).
2. Redeploy. Recording starts on its own wherever Supabase is configured; set
   `VITE_SITE_ANALYTICS=off` in Vercel to stop it.
3. Sign in as an admin → **Admin → Analytics**. Then under **Settings**, tick
   *Don't record visits from this browser* on each device you use, so your own
   browsing stays out of the numbers.

| Report | What it shows |
| --- | --- |
| Overview | Visits, visitors, conversion, revenue, add-to-bag rate, pages per visit, visits per day, sources (UTM tag or referring site), devices |
| Funnel | Visits reaching: visited → viewed a fragrance → added to bag → started checkout → went to payment → purchased |
| Pages & paths | Views, landings, exits and average scroll depth per page; the most common page-to-page moves |
| Customer journeys | Each visit as its pages and key actions in order — filter to buyers, or to visits that left with items in the bag |
| Heatmaps | Clicks drawn over the live page at desktop, tablet or mobile width; how far down visitors scrolled; the most clicked buttons and links |

**What is stored:** a random visitor id and visit id, the page path (no query
string), UTM tags and the referring site's name, device size, click positions
with the clicked button's label, scroll depth, and shopping events with their
value and fragrance ids. Never names, emails, addresses or anything typed.
Admin, staff, account and reset pages are never recorded. Browsers sending
Global Privacy Control are not recorded.

**Heatmaps** use the page as it is today, so after a redesign pick a short date
range or old clicks will sit over the new layout.

**Retention:** Settings → *Delete older events* removes anything over 13 months.

## 6. Session recordings (optional): Microsoft Clarity

Your own analytics shows where people click; Clarity adds recordings of real
visits. It's free.

1. <https://clarity.microsoft.com> → **New project** → your site's address.
2. Copy the project ID (Settings → Overview, e.g. `k3abc9xyz1`).
3. Vercel → Environment Variables → `VITE_CLARITY_ID` = that ID, Production only. Redeploy.
4. Admin → Analytics → Settings then links straight to your Clarity dashboard.

Clarity masks typed text by default. Add a line to the privacy policy: the site
uses Microsoft Clarity to understand how it is used, with a link to
<https://privacy.microsoft.com/privacystatement>.
