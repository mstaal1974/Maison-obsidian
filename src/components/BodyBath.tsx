import { useEffect, useMemo, useRef, useState } from "react";
import { type Fragrance, type FormatKey, type Filter, matches, moneyExact } from "../lib/data";
import { GIFT_BOX_PRICE, matchesReference, referenceOf, sku as skuOf } from "../lib/formats";
import type { GiftCard } from "../lib/bag";
import { joinWaitlist } from "../lib/waitlist";
import { trackViewItemList } from "../lib/analytics";
import BottleImage from "./BottleImage";
import { Arrow, Container, Icon, InspiredBy } from "./ui";
import { btnGold } from "./styles";
import "../styles/body-bath.css";

const BOX = "ritual";
const BOX_IMAGE = "/assets/gift-box.jpg";
const PAGE_SIZE = 6;
const LIMIT = { to: 40, from: 40, note: 240 } as const;
const EMPTY_CARD: GiftCard = { to: "", from: "", note: "" };
const FILTERS = [
  { value: "all", label: "All scents" },
  { value: "men", label: "For him" },
  { value: "women", label: "For her" },
  { value: "unisex", label: "Unisex" },
] as const;
type ScentFilter = Filter | "unisex";

interface BodyBathProps {
  fragrances: Fragrance[];
  vip: boolean;
  onAdd: (frag: Fragrance, format: FormatKey, gift: GiftCard | null) => void;
}

function jumpTo(heading: HTMLHeadingElement | null) {
  heading?.focus({ preventScroll: true });
  heading?.scrollIntoView({ block: "start" });
}

export default function BodyBath({ fragrances, vip, onAdd }: BodyBathProps) {
  const [filter, setFilter] = useState<ScentFilter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [includeCard, setIncludeCard] = useState(false);
  const [card, setCard] = useState<GiftCard>(EMPTY_CARD);
  const [added, setAdded] = useState(false);
  const scentHeading = useRef<HTMLHeadingElement>(null);
  const boxHeading = useRef<HTMLHeadingElement>(null);

  const boxes = useMemo(() => fragrances
    .filter((f) => !f.vipOnly || vip)
    .map((fragrance) => ({ fragrance, sku: skuOf(fragrance, BOX) }))
    .filter(({ sku }) => sku.status !== "hidden")
    .sort((a, b) => Number(b.sku.buyable) - Number(a.sku.buyable)), [fragrances, vip]);
  const results = boxes.filter(({ fragrance }) => {
    const matchesFilter = filter === "unisex" ? fragrance.gender === "unisex" : matches(fragrance, filter);
    return matchesFilter && (fragrance.name.toLowerCase().includes(query.trim().toLowerCase()) || matchesReference(fragrance, query));
  });
  const visible = results.slice(0, limit);
  const visibleIds = visible.map(({ fragrance }) => fragrance.id).join(",");
  useEffect(() => {
    if (!visibleIds) return;
    const timer = window.setTimeout(() => {
      trackViewItemList(`body_${filter}`, visible.map(({ fragrance, sku }) => ({ id: fragrance.id, name: fragrance.name, priceCents: sku.price })));
    }, 800);
    return () => window.clearTimeout(timer);
    // Track distinct visible lists, not unrelated renders such as gift card edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, visibleIds]);

  const selection = boxes.find(({ fragrance }) => fragrance.id === selectedId);
  const prices = [...new Set(boxes.filter(({ sku }) => sku.buyable).map(({ sku }) => sku.price))];
  const boxPrice = prices.length > 1 ? `From ${moneyExact(Math.min(...prices))}` : moneyExact(prices[0] ?? GIFT_BOX_PRICE);
  const gift = { to: card.to.trim(), from: card.from.trim(), note: card.note.trim() };
  const giftReady = !includeCard || Boolean(gift.to || gift.from || gift.note);

  const chooseScent = (id: string) => {
    setSelectedId(id);
    setAdded(false);
    // On smaller screens the summary follows the catalogue.
    if (window.matchMedia("(max-width: 860px)").matches) {
      window.requestAnimationFrame(() => jumpTo(boxHeading.current));
    }
  };

  return (
    <main className="mo-bodybath" data-screen-label="Body & Bath">
      <section className="mo-bb-hero" aria-labelledby="body-bath-title">
        <Container className="mo-bb-hero-layout">
          <div className="mo-bb-hero-copy">
            <p className="mo-bb-eyebrow">Body &amp; Bath</p>
            <h1 id="body-bath-title">Your scent, from shower to skin.</h1>
            <p>Layer your favourite fragrance with the Maison Obsidian Gift Box. Each set pairs a 30 ml eau de parfum with a matching body wash and body lotion.</p>
            <div className="mo-bb-hero-action">
              <button type="button" className="mo-cta" style={btnGold} onClick={() => jumpTo(scentHeading.current)}>
                Choose a scent <Arrow />
              </button>
              <span className="mo-bb-price">{boxPrice}</span>
            </div>
          </div>
          <div className="mo-bb-hero-art">
            <img src={BOX_IMAGE} alt="Maison Obsidian perfume, body wash and body lotion with the black Gift Box" width={1024} height={1024} fetchPriority="high" />
          </div>
        </Container>
      </section>

      <Container className="mo-bb-builder">
        <section className="mo-bb-catalogue" aria-labelledby="body-scent-title">
          <h2 id="body-scent-title" ref={scentHeading} tabIndex={-1}>Choose your scent</h2>
          <p className="mo-bb-intro">Browse the collection or search for a fragrance you already love.</p>
          <div className="mo-bb-controls">
            <div className="mo-bb-filters" role="group" aria-label="Filter scents">
              {FILTERS.map(({ value, label }) => (
                <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setLimit(PAGE_SIZE); }}>{label}</button>
              ))}
            </div>
            <label className="mo-bb-search">
              <Icon name="search" size={16} />
              <input type="search" aria-label="Search by scent name or inspiration" placeholder="Search name or inspiration" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE_SIZE); }} />
            </label>
          </div>
          <p className="mo-bb-result-count" role="status">
            {results.length ? `Showing ${visible.length} of ${results.length} ${results.length === 1 ? "scent" : "scents"}` : "No matching scents"}
          </p>
          {visible.length > 0 ? (
            <ul className="mo-bb-tiles">
              {visible.map(({ fragrance, sku }) => {
                const selected = fragrance.id === selection?.fragrance.id;
                const notes = [...new Set([...fragrance.top, ...fragrance.heart])].slice(0, 3);
                return (
                  <li key={fragrance.id}>
                    <button type="button" className="mo-bb-scent" aria-pressed={selected} onClick={() => chooseScent(fragrance.id)}>
                      <div className="mo-bb-scent-head">
                        <BottleImage imageUrl={fragrance.imageUrl} fallbackSrc="/assets/bottle-portrait.webp" alt="" accent={fragrance.accent} liquid={fragrance.liquid} height={72} />
                        <span className="mo-bb-scent-name">{fragrance.name}</span>
                      </div>
                      <InspiredBy {...referenceOf(fragrance)} size="sm" />
                      {notes.length > 0 && <span className="mo-bb-notes">{notes.join(" · ")}</span>}
                      <span className="mo-bb-scent-action">
                        {selected ? "Selected" : sku.buyable ? "Choose scent" : sku.availability}
                        {selected ? <span aria-hidden="true">✓</span> : <Arrow size={11} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mo-bb-empty">
              <p>{boxes.length ? "Try another scent name or browse all scents." : "There are no Gift Box scents listed right now."}</p>
              {boxes.length > 0 && <button type="button" className="mo-bb-link" onClick={() => { setQuery(""); setFilter("all"); setLimit(PAGE_SIZE); }}>Clear filters</button>}
            </div>
          )}
          {visible.length < results.length && (
            <button type="button" className="mo-bb-more" onClick={() => setLimit(limit + PAGE_SIZE)}>Show more scents <span aria-hidden="true">+</span></button>
          )}
        </section>

        <section className="mo-bb-summary" aria-labelledby="body-box-title">
          <div className="mo-bb-summary-title">
            <h2 id="body-box-title" ref={boxHeading} tabIndex={-1}>Your Gift Box</h2>
            <span className="mo-bb-price">{selection ? moneyExact(selection.sku.price) : boxPrice}</span>
          </div>
          <ul className="mo-bb-includes" aria-label="What's inside the Gift Box">
            <li>30 ml eau de parfum</li>
            <li>Body wash</li>
            <li>Body lotion</li>
          </ul>
          {selection ? (
            <>
              <div className="mo-bb-selected">
                <div>
                  <p className="mo-bb-eyebrow">Selected scent</p>
                  <h3>{selection.fragrance.name}</h3>
                </div>
                <button type="button" className="mo-bb-link" onClick={() => jumpTo(scentHeading.current)}>Change scent</button>
              </div>
              <p className="mo-bb-availability">{selection.sku.availability}</p>
              {selection.sku.buyable ? (
                <form className="mo-bb-order" onSubmit={(e) => {
                  e.preventDefault();
                  if (!giftReady) return;
                  onAdd(selection.fragrance, BOX, includeCard ? gift : null);
                  setAdded(true);
                }}>
                  <label className="mo-bb-card-toggle">
                    <input type="checkbox" checked={includeCard} onChange={(e) => { setIncludeCard(e.target.checked); setAdded(false); }} />
                    Add a handwritten gift card
                  </label>
                  {includeCard && (
                    <div className="mo-bb-card-fields" onChange={() => setAdded(false)}>
                      <p>We’ll pack your card inside the box. Prices aren’t included in the parcel.</p>
                      <div className="mo-bb-card-names">
                        <label>To<input value={card.to} maxLength={LIMIT.to} onChange={(e) => setCard({ ...card, to: e.target.value })} /></label>
                        <label>From<input value={card.from} maxLength={LIMIT.from} onChange={(e) => setCard({ ...card, from: e.target.value })} /></label>
                      </div>
                      <label>Message<textarea rows={3} value={card.note} maxLength={LIMIT.note} onChange={(e) => setCard({ ...card, note: e.target.value })} /></label>
                      {!giftReady && <p>Fill in at least one field to include a card.</p>}
                    </div>
                  )}
                  <button type="submit" className="mo-cta mo-bb-add" style={btnGold} disabled={!giftReady}>Add to bag · {moneyExact(selection.sku.price)} <Arrow /></button>
                  <p className="mo-bb-order-status" role="status">{added && `Added ${selection.fragrance.name} to your bag.`}</p>
                </form>
              ) : (
                <NotifyMe key={selection.fragrance.id} fragrance={selection.fragrance} />
              )}
            </>
          ) : (
            <p className="mo-bb-summary-hint">Choose a scent to check availability and add an optional handwritten card.</p>
          )}
        </section>
      </Container>
    </main>
  );
}

function NotifyMe({ fragrance }: { fragrance: Fragrance }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  return (
    <form className="mo-bb-order mo-bb-notify" onSubmit={async (e) => {
      e.preventDefault();
      setState("busy");
      setState((await joinWaitlist(fragrance.id, BOX, email)) ? "done" : "error");
    }}>
      {state === "done" ? (
        <p role="status">We’ll email you when the {fragrance.name} Gift Box is available.</p>
      ) : (
        <>
          <p>Get an email when this Gift Box is available.</p>
          <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button type="submit" className="mo-cta mo-bb-add" style={btnGold} disabled={state === "busy"}>{state === "busy" ? "Saving…" : "Notify me"} <Arrow /></button>
          {state === "error" && <p role="alert">That didn’t save. Check your email address and try again.</p>}
        </>
      )}
    </form>
  );
}
