import { useMemo, useState } from "react";
import { type FormatKey, type Fragrance, moneyExact } from "../lib/data";
import { formatParam, sku as skuOf, type Sku } from "../lib/formats";
import { LANDING_BY_SLUG } from "../lib/landings";
import { paths } from "../lib/route";
import BottleImage from "./BottleImage";
import { Arrow, Container } from "./ui";
import { btnGold } from "./styles";
import "../styles/gift-shop.css";

const FORMATS = ["perf50", "perf30", "perf10", "car"] as const;
const FORMAT_LABELS: Record<typeof FORMATS[number], string> = {
  perf50: "50 ml perfume",
  perf30: "30 ml perfume",
  perf10: "10 ml perfume",
  car: "Car diffuser",
};
const BUDGETS = [
  { cap: 2000, id: "gifts-under-20", title: "Gifts under $20", detail: "Try a travel-size perfume or a hanging car diffuser." },
  { cap: 5000, id: "gifts-under-50", title: "Gifts under $50", detail: "Shop individual perfumes and car diffusers." },
] as const;
const PAGE_SIZE = 4;
type GiftProduct = { fragrance: Fragrance; sku: Sku; format: typeof FORMATS[number] };

export default function GiftShop({ fragrances, vip }: { fragrances: Fragrance[]; vip: boolean }) {
  const products = useMemo(() => fragrances
    .filter((f) => !f.vipOnly || vip)
    .flatMap((fragrance) => FORMATS.map((format) => ({ fragrance, format, sku: skuOf(fragrance, format) })))
    .filter(({ sku }) => sku.buyable && sku.price > 0 && sku.price < 5000), [fragrances, vip]);

  return (
    <main className="mo-gift-shop" data-screen-label="Gifts">
      <header className="mo-gift-hero">
        <Container className="mo-gift-container">
          <p className="mo-gift-kicker">Gifts</p>
          <h1>{LANDING_BY_SLUG.gifts.h1}</h1>
          <p className="mo-gift-intro">{LANDING_BY_SLUG.gifts.intro}</p>
          <nav className="mo-gift-nav" aria-label="Shop gifts by budget or gift card">
            <a href={paths.giftCard} className="mo-gift-nav-card mo-gift-nav-voucher">
              <span>Gift Cards</span>
              <span>$10–$500 · Delivered by email</span>
              <strong style={btnGold}>Shop gift cards <Arrow /></strong>
            </a>
            {BUDGETS.map(({ id, title, detail }) => (
              <a key={id} href={`#${id}`} className="mo-gift-nav-card">
                <span>{title}</span>
                <span>{detail}</span>
                <Arrow />
              </a>
            ))}
          </nav>
        </Container>
      </header>

      <Container className="mo-gift-container">
        {BUDGETS.map((budget) => <BudgetShelf key={budget.id} budget={budget} products={products} />)}
        <nav className="mo-gift-extra" aria-label="More gift options">
          <a href={paths.discovery}>Discovery Box <Arrow /></a>
          <a href={paths.body}>Body &amp; Bath Gift Box <Arrow /></a>
          <a href={paths.shop("gifts-for-her")}>Gifts for her <Arrow /></a>
          <a href={paths.shop("gifts-for-him")}>Gifts for him <Arrow /></a>
        </nav>
      </Container>
    </main>
  );
}

function BudgetShelf({ budget, products }: { budget: typeof BUDGETS[number]; products: GiftProduct[] }) {
  const [format, setFormat] = useState<FormatKey | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const eligible = products.filter(({ sku }) => sku.price < budget.cap);
  // Lead the wider budget with additional choices while keeping lower prices searchable.
  if (budget.cap === 5000) eligible.sort((a, b) => Number(b.sku.price >= 2000) - Number(a.sku.price >= 2000));
  const formats = FORMATS.filter((key) => eligible.some((product) => product.format === key));
  const currentFormat = formats.find((key) => key === format);
  const results = currentFormat ? eligible.filter((product) => product.format === currentFormat) : eligible;

  return (
    <section id={budget.id} className="mo-gift-shelf" aria-labelledby={`${budget.id}-title`}>
      <div className="mo-gift-shelf-head">
        <h2 id={`${budget.id}-title`}>{budget.title}</h2>
        {formats.length > 1 && (
          <div role="group" aria-label={`Product formats for ${budget.title}`} className="mo-gift-filters">
            <button type="button" aria-pressed={!currentFormat} onClick={() => { setFormat(null); setLimit(PAGE_SIZE); }}>All formats</button>
            {formats.map((key) => (
              <button key={key} type="button" aria-pressed={currentFormat === key} onClick={() => { setFormat(key); setLimit(PAGE_SIZE); }}>{FORMAT_LABELS[key]}</button>
            ))}
          </div>
        )}
      </div>
      {results.length ? (
        <ul className="mo-gift-products">
          {results.slice(0, limit).map(({ fragrance, sku, format }) => (
            <li key={sku.code}>
              <a className="mo-gift-product mo-card" href={paths.product(fragrance.slug, formatParam(format))}>
                {format === "car" ? (
                  <img className="mo-gift-product-image" src="/assets/car-freshner.jpg" alt="" loading="lazy" />
                ) : (
                  <BottleImage imageUrl={fragrance.imageUrl} fallbackSrc="/assets/bottle-portrait.webp" alt="" accent={fragrance.accent} liquid={fragrance.liquid} height="100%" />
                )}
                <div className="mo-gift-product-copy">
                  <span className="mo-gift-kicker">{FORMAT_LABELS[format]}</span>
                  <h3>{fragrance.name}</h3>
                  <span className="mo-gift-product-price">{moneyExact(sku.price)} <Arrow /></span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      ) : <p className="mo-gift-intro">No individual gifts are available in this price range right now.</p>}
      {results.length > limit && (
        <button type="button" className="mo-gift-more" onClick={() => setLimit(limit + PAGE_SIZE)}>Show more gifts under {moneyExact(budget.cap)} <span aria-hidden="true">+</span></button>
      )}
    </section>
  );
}
