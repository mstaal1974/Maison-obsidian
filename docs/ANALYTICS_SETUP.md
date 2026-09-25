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
| `page_view` | Every storefront screen (admin, staff and account screens are not tracked; query strings are dropped) |
| `view_item` | A fragrance page is opened |
| `add_to_cart` | Anything goes in the bag (product page, quick view, Discovery Box, car diffuser, Scent DNA sample) |
| `begin_checkout` | The customer continues to payment |
| `purchase` | A paid order is confirmed on the thank-you page, with its total and items |

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
   page, the shop pages and one page per launched fragrance.
2. **URL inspection** → paste a fragrance URL → **Request indexing** for the
   handful of pages that matter most.
3. Link it to Analytics: GA → **Admin → Product links → Search Console links**.
   Search queries then show up inside GA too.

Expect data to start showing in Search Console after 2–3 days.
