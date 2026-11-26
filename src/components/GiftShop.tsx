import { useMemo, useState } from "react";
import { type Fragrance, moneyExact } from "../lib/data";
import { formatParam, sku as skuOf } from "../lib/formats";
import { LANDING_BY_SLUG } from "../lib/landings";
import { paths } from "../lib/route";
import BottleImage from "./BottleImage";
import { Arrow, Container } from "./ui";
import { btnGhost, btnGold } from "./styles";
import "../styles/gift-shop.css";

const FORMATS = [
  { key: "perf10", label: "10 ml perfume" },
  { key: "car", label: "Car diffuser" },
  { key: "perf30", label: "30 ml perfume" },
  { key: "perf50", label: "50 ml perfume" },
] as const;
const BUDGETS = [2000, 5000] as const;
const PAGE_SIZE = 4;
const GIFT_SETS = [
  { title: "Discovery Box", copy: "Give them several scents to try.", href: paths.discovery, image: "/assets/10-ml-bottles-Remix-1.jpg" },
  { title: "Body & Bath Gift Box", copy: "Pair their favourite scent with a matching body wash and lotion.", href: paths.body, image: "/assets/gift-box.jpg" },
];

export default function GiftShop({ fragrances, vip }: { fragrances: Fragrance[]; vip: boolean }) {
  const [budget, setBudget] = useState<number>(BUDGETS[0]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const catalogue = useMemo(() => fragrances
    .filter((fragrance) => !fragrance.vipOnly || vip)
    .map((fragrance) => ({
      fragrance,
      options: FORMATS.map(({ key, label }) => ({ label, sku: skuOf(fragrance, key) }))
        .filter(({ sku }) => sku.buyable && sku.price > 0 && sku.price < BUDGETS[1]),
    })), [fragrances, vip]);
  const results = catalogue
    .map(({ fragrance, options }) => ({ fragrance, options: options.filter(({ sku }) => sku.price < budget) }))
    .filter(({ options }) => options.length > 0);

  return (
    <main className="mo-gift-shop" data-screen-label="Gifts">
      <header className="mo-gift-hero">
        <Container className="mo-gift-container">
          <p className="mo-gift-kicker">Gifts</p>
          <h1>{LANDING_BY_SLUG.gifts.h1}</h1>
          <nav className="mo-gift-nav" aria-label="Gift shopping options">
            <a href={paths.giftCard} style={btnGold} aria-describedby="gift-card-detail">Send a gift card <Arrow /></a>
            <a href="#browse-gifts" style={btnGhost}>Browse gifts <Arrow /></a>
          </nav>
          <p id="gift-card-detail" className="mo-gift-intro">Gift cards from $10 to $500 · Delivered by email</p>
        </Container>
      </header>

      <Container className="mo-gift-container">
        <section id="browse-gifts" className="mo-gift-shelf" aria-labelledby="gift-shelf-title">
          <div className="mo-gift-shelf-head">
            <h2 id="gift-shelf-title">Shop by budget</h2>
            <div role="group" aria-label="Gift budget" className="mo-gift-filters">
              {BUDGETS.map((cap) => (
                <button key={cap} type="button" aria-pressed={budget === cap} aria-controls="gift-results" onClick={() => { setBudget(cap); setLimit(PAGE_SIZE); }}>
                  Under {moneyExact(cap)}
                </button>
              ))}
            </div>
          </div>
          <div id="gift-results">
            <p className="mo-gift-count" role="status">{results.length ? `${results.length} ${results.length === 1 ? "scent" : "scents"}` : "No gifts available in this price range right now."}</p>
            {results.length > 0 && (
              <ul className="mo-gift-products">
                {results.slice(0, limit).map(({ fragrance, options }) => (
                  <li key={fragrance.id} className="mo-gift-product">
                    <BottleImage imageUrl={fragrance.imageUrl} fallbackSrc="/assets/bottle-portrait.webp" alt="" accent={fragrance.accent} liquid={fragrance.liquid} height="100%" />
                    <div className="mo-gift-product-copy">
                      <h3>{fragrance.name}</h3>
                      <ul className="mo-gift-options" aria-label={`${fragrance.name} gift formats`}>
                        {options.map(({ sku, label }) => (
                          <li key={sku.key}>
                            <a href={paths.product(fragrance.slug, formatParam(sku.key))} aria-label={`${fragrance.name}, ${label}, ${moneyExact(sku.price)}`}>
                              <span>{label}</span><span>{moneyExact(sku.price)} <Arrow size={10} /></span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {results.length > limit && (
              <button type="button" className="mo-gift-more" onClick={() => setLimit((count) => count + PAGE_SIZE)}>Show more scents <span aria-hidden="true">+</span></button>
            )}
          </div>
        </section>

        <section className="mo-gift-sets" aria-labelledby="gift-sets-title">
          <h2 id="gift-sets-title">Gift sets</h2>
          <div className="mo-gift-set-grid">
            {GIFT_SETS.map(({ title, copy, href, image }) => (
              <a key={href} href={href} className="mo-gift-set">
                <img src={image} alt="" loading="lazy" />
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  <Arrow />
                </div>
              </a>
            ))}
          </div>
        </section>
      </Container>
    </main>
  );
}
