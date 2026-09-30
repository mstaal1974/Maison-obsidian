import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { type Fragrance, type FormatKey, GOLD, CREAM, money } from "../lib/data";
import { sku as skuOf, profileOf, referenceOf, experienceOf, relatedTo, formatFromParam, type Sku } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import { productMeta, siteOrigin, usePageMeta } from "../lib/seo";
import { summarise, useReviews } from "../lib/reviews";
import { isNew } from "../lib/launch";
import Reviews, { Stars } from "./Reviews";
import BottleImage from "./BottleImage";
import FragranceCard from "./FragranceCard";
import NotifyMe from "./NotifyMe";
import { bottleBackdrop } from "./adminStyles";
import { FormatGlyph } from "./ProductGlyphs";
import { Arrow, Container, Icon, IconBadge, SideCaption, InspiredBy } from "./ui";
import { trackFormatSelected, trackSubscriptionOfferViewed, trackViewItem } from "../lib/analytics";
import { MONO, SERIF, btnGold, btnLink, micro } from "./styles";

interface ProductDetailProps {
  frag: Fragrance;
  fragrances: Fragrance[];
  vip: boolean;
  onAdd: (f: Fragrance, key: FormatKey, qty: number, engraving: string | null) => void;
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
  /** Signed-in customer, for the review form. */
  userId: string | null;
  /** Prefills the Notify me form. */
  userEmail?: string | null;
  onSignIn: () => void;
}

const ENGRAVE_MAX = 28;

// The three perfume sizes, each with the job it does for the shopper.
const CORE: { key: FormatKey; size: string; role: string }[] = [
  { key: "perf10", size: "10 ml", role: "Try it" },
  { key: "perf30", size: "30 ml", role: "Everyday" },
  { key: "perf50", size: "50 ml", role: "Signature" },
];
const EXTRA_KEYS: FormatKey[] = ["car", "wash", "moist", "ritual"];
const EXTRA_NOTE: Partial<Record<FormatKey, string>> = {
  car: "Take the scent with you",
  wash: "Cleanse with character",
  moist: "Hydrate and layer",
  ritual: "Perfume, wash and moisturiser together",
};

/** The perfume size to start on: the everyday 30 ml, else whichever can be bought. */
function defaultPerfume(frag: Fragrance): FormatKey {
  return (["perf30", "perf50", "perf10"] as FormatKey[]).find((k) => skuOf(frag, k).buyable) ?? "perf50";
}

/** Opens on ?format=… when that SKU is live (Shopping links), else the default perfume. */
function initialFormat(frag: Fragrance): FormatKey {
  const asked = formatFromParam(new URLSearchParams(window.location.search).get("format"));
  return asked && skuOf(frag, asked).status === "live" ? asked : defaultPerfume(frag);
}

/** An accessible, keyboard-operable disclosure (native <details>). */
function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="mo-disclosure" open={defaultOpen} style={{ borderTop: "1px solid #1f1f27" }}>
      <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", fontFamily: SERIF, fontSize: 22, color: CREAM }}>
        {title}
        <span aria-hidden className="mo-disclosure-caret" style={{ color: GOLD, fontSize: 18, transition: "transform .2s" }}>+</span>
      </summary>
      <div style={{ padding: "0 0 20px" }}>{children}</div>
    </details>
  );
}

/**
 * One page per scent, in the order a decision is made: the scent itself, then
 * a size, then reassurance and the button. Car, body and coming-soon formats,
 * add-ons and the long-form detail follow, each out of the way until asked for.
 */
export default function ProductDetail({ frag, fragrances, vip, onAdd, onQuickView, userId, userEmail, onSignIn }: ProductDetailProps) {
  const [key, setKey] = useState<FormatKey>(() => initialFormat(frag));
  const [qty, setQty] = useState(1);
  const [engraveOn, setEngraveOn] = useState(false);
  const [engraving, setEngraving] = useState("");
  // Coming-soon formats: which one's Notify me form is open, and which this
  // visitor has joined the waitlist for.
  const [notifyKey, setNotifyKey] = useState<FormatKey | null>(null);
  const [notified, setNotified] = useState<Set<FormatKey>>(new Set());
  const { reviews, enabled: reviewsOn } = useReviews(frag.id);
  const rating = useMemo(() => summarise(reviews), [reviews]);
  usePageMeta(useMemo(() => productMeta(frag, siteOrigin(), frag.imageUrl, rating), [frag, rating]));
  // Once per fragrance opened (not on every re-render or rating load).
  useEffect(() => {
    trackViewItem({ id: frag.id, name: frag.name, format: key, priceCents: skuOf(frag, key).price });
    trackSubscriptionOfferViewed("product");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frag.id]);

  const chosen = skuOf(frag, key);
  const locked = !!frag.vipOnly && !vip;
  const profile = profileOf(frag);
  const related = useMemo(() => relatedTo(frag, fragrances, 4), [frag, fragrances]);
  const core = CORE.map((c) => ({ ...c, s: skuOf(frag, c.key) })).filter((c) => c.s.status !== "hidden");
  const extras = EXTRA_KEYS.map((k) => skuOf(frag, k)).filter((s) => s.status !== "hidden");
  const extrasLive = extras.filter((s) => s.status === "live");
  const extrasSoon = extras.filter((s) => s.status === "coming_soon");
  const livePrices = core.filter((c) => c.s.status === "live").map((c) => c.s.price);

  const choose = (k: FormatKey) => {
    setKey(k);
    const s = skuOf(frag, k);
    trackFormatSelected({ id: frag.id, name: frag.name, format: k, priceCents: s.price });
  };

  // Ways to extend the purchase, offered after the main choice rather than
  // before it: the same scent in the car or on the body, and a 10 ml of the
  // closest related scent.
  const pairings = useMemo(() => {
    const out: { id: string; frag: Fragrance; key: FormatKey; title: string; note: string; price: number }[] = [];
    for (const k of ["car", "wash", "moist"] as FormatKey[]) {
      const s = skuOf(frag, k);
      if (k !== key && s.buyable) out.push({ id: k, frag, key: k, title: `${frag.name} ${s.def.label}`, note: k === "car" ? "Same scent, in the car" : "Layer the scent on your skin", price: s.price });
    }
    const other = related.find((r) => !(r.vipOnly && !vip) && skuOf(r, "perf10").buyable);
    if (other) out.push({ id: `sample:${other.id}`, frag: other, key: "perf10", title: `${other.name} 10ml`, note: "The closest match to this scent, to try", price: skuOf(other, "perf10").price });
    return out;
  }, [frag, key, related, vip]);

  const canEngrave = chosen.def.group === "wear";
  const finalEngraving = canEngrave && engraveOn ? engraving.trim().slice(0, ENGRAVE_MAX) || null : null;
  const canBuy = chosen.buyable && !locked;
  const buyLabel = locked ? "VIP members only" : !chosen.buyable ? (chosen.status === "coming_soon" ? "Coming soon" : "Sold out") : "Add to bag";
  const add = () => onAdd(frag, key, qty, finalEngraving);

  // Sticky purchase bar on phones, once the main button has scrolled away
  // above the viewport. CSS keeps it off wider screens.
  const ctaRef = useRef<HTMLButtonElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting || entry.boundingClientRect.top > 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // While the bar shows, CSS lifts the chat button clear of it (phones only).
  const stickyOn = !ctaVisible && canBuy;
  useEffect(() => {
    document.body.classList.toggle("mo-has-sticky-buy", stickyOn);
    return () => document.body.classList.remove("mo-has-sticky-buy");
  }, [stickyOn]);

  const sizeButton = ({ key: k, size, role, s }: (typeof core)[number]) => {
    const active = k === key;
    return (
      <button
        key={k}
        onClick={() => choose(k)}
        aria-pressed={active}
        style={{
          flex: "1 1 0",
          minWidth: 96,
          background: active ? "rgba(201,169,97,0.12)" : "#0c0c10",
          border: `1px solid ${active ? GOLD : "#2a2a33"}`,
          padding: "12px 10px",
          cursor: "pointer",
          color: CREAM,
          textAlign: "left",
          opacity: s.buyable ? 1 : 0.6,
        }}
      >
        <span style={{ display: "block", fontFamily: SERIF, fontSize: 20 }}>{size}</span>
        <span style={{ display: "block", ...micro, fontSize: 8.5, color: active ? GOLD : "rgba(243,236,220,0.6)", marginTop: 2 }}>{role}</span>
        <span style={{ display: "block", fontFamily: MONO, fontSize: 12.5, marginTop: 8 }}>{s.status === "coming_soon" ? "Coming soon" : money(s.price)}</span>
      </button>
    );
  };

  const extraRow = (s: Sku) => {
    const soon = s.status === "coming_soon";
    const active = s.key === key;
    return (
      <div key={s.key} style={{ borderTop: "1px solid #17171d" }}>
        <button
          onClick={() => (soon ? setNotifyKey((k) => (k === s.key ? null : s.key)) : choose(s.key))}
          aria-pressed={soon ? undefined : active}
          aria-expanded={soon ? notifyKey === s.key : undefined}
          style={{ width: "100%", display: "grid", gridTemplateColumns: "40px 1fr auto", gap: 12, alignItems: "center", background: active ? "rgba(201,169,97,0.08)" : "none", border: 0, padding: "10px 4px", cursor: "pointer", color: CREAM, textAlign: "left" }}
        >
          <span style={{ height: 46, display: "grid", placeItems: "center" }}>
            <FormatGlyph formatKey={s.key} liquid={frag.liquid} height={s.key === "ritual" ? 30 : 42} />
          </span>
          <span>
            <span style={{ display: "block", fontFamily: SERIF, fontSize: 18 }}>{s.def.label}</span>
            <span style={{ display: "block", fontSize: 12, color: "rgba(243,236,220,0.55)" }}>{EXTRA_NOTE[s.key]}</span>
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: soon ? GOLD : CREAM }}>
            {soon ? (notified.has(s.key) ? "On the list ✓" : "Notify me") : active ? "Selected" : money(s.price)}
          </span>
        </button>
        {soon && notifyKey === s.key && (
          <div style={{ padding: "4px 4px 14px" }}>
            <NotifyMe
              key={s.key}
              fragranceId={frag.id}
              format={s.key}
              defaultEmail={userEmail}
              note={`One email when ${frag.name} ${s.def.name} is ready, nothing else.`}
              onDone={() => setNotified((n) => new Set(n).add(s.key))}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <main data-screen-label="Product">
      {/* ── Steps 1 & 2: the scent, a size, the button ── */}
      <div className="mo-pdp-grid" style={{ display: "grid", gridTemplateColumns: "0.72fr 1.28fr", borderBottom: "1px solid #1f1f27" }}>
        <div className="mo-pdp-image" style={{ borderRight: "1px solid #1f1f27", padding: "18px 24px 22px 32px" }}>
          <div style={{ position: "relative", background: bottleBackdrop(frag.accent, frag.liquid), border: "1px solid #1f1f27" }}>
            <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-pdp.jpg" alt={`${frag.name} bottle`} accent={frag.accent} liquid={frag.liquid} height="var(--pdp-image-h, 548px)" objectPosition="center 45%" />
          </div>
        </div>

        <div className="mo-pdp-details" style={{ padding: "18px 32px 26px 30px", display: "grid", gridTemplateColumns: "1fr auto", gap: 18 }}>
          <div style={{ minWidth: 0, maxWidth: 640 }}>
            <nav aria-label="Breadcrumb" style={{ ...micro, fontSize: 8.5, display: "flex", gap: 6 }}>
              <a href={paths.home} style={{ ...btnLink, color: "rgba(243,236,220,0.5)", fontSize: 8.5, textDecoration: "none" }}>Home</a> /
              <a href={paths.fragrances} style={{ ...btnLink, color: "rgba(243,236,220,0.5)", fontSize: 8.5, textDecoration: "none" }}>Fragrances</a> /
              <span style={{ color: "rgba(243,236,220,0.8)" }}>{frag.name}</span>
            </nav>
            <h1 className="mo-pdp-title" style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 54, lineHeight: 1, color: CREAM }}>{frag.name}</h1>
            <div style={{ ...micro, color: GOLD, marginTop: 10, letterSpacing: "0.3em", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {isNew(frag) && <span style={{ color: "#0b0b0d", background: GOLD, padding: "3px 8px", letterSpacing: "0.2em", fontWeight: 600 }}>New arrival</span>}
              <span>{profile.join(" · ")}</span>
            </div>
            {rating && (
              <a href="#reviews" onClick={(e) => { e.preventDefault(); document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" }); }} style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 12.5, color: CREAM, textDecoration: "none" }}>
                <Stars value={rating.average} /> {rating.average.toFixed(1)} · {rating.count} {rating.count === 1 ? "review" : "reviews"}
              </a>
            )}
            <p style={{ margin: "12px 0 0", fontFamily: SERIF, fontSize: 18, lineHeight: 1.45, color: "rgba(243,236,220,0.8)" }}>{frag.story}</p>

            <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 22, color: CREAM }}>Choose your size</h2>
              {livePrices.length > 0 && <span style={{ fontFamily: MONO, fontSize: 13, color: CREAM }}>From {money(Math.min(...livePrices))}</span>}
            </div>
            <div className="mo-size-row" style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>{core.map(sizeButton)}</div>
            {chosen.def.group !== "wear" && (
              <p style={{ margin: "10px 0 0", fontSize: 13, color: GOLD }}>
                Selected: {chosen.def.name}.{" "}
                <button style={{ ...btnLink, fontSize: 9 }} onClick={() => choose(defaultPerfume(frag))}>
                  Back to perfume
                </button>
              </p>
            )}

            {/* Purchase: the chosen SKU, its price and availability, one button. */}
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #2a2a33", height: 52 }}>
                <button aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 44, height: "100%", background: "none", border: 0, color: CREAM, cursor: "pointer", fontSize: 18 }}>−</button>
                <span aria-live="polite" style={{ fontFamily: MONO, fontSize: 14, color: CREAM, minWidth: 28, textAlign: "center" }}>
                  <span className="mo-sr-only">Quantity </span>{qty}
                </span>
                <button aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(9, q + 1))} style={{ width: 44, height: "100%", background: "none", border: 0, color: CREAM, cursor: "pointer", fontSize: 18 }}>+</button>
              </div>
              <button
                ref={ctaRef}
                className="mo-cta"
                style={{ ...btnGold, flex: "1 1 240px", justifyContent: "center", height: 52, fontSize: 12, letterSpacing: "0.24em", opacity: canBuy ? 1 : 0.5 }}
                disabled={!canBuy}
                onClick={add}
              >
                <Icon name="bag" size={14} color="#0b0b0d" /> {buyLabel}
                {canBuy && <> · {money(chosen.price * qty)}</>}
              </button>
            </div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 12.5 }}>
              <span style={{ color: chosen.status === "live" && (chosen.stock > 0 || chosen.def.group === "wear") ? "#8bb98a" : GOLD }}>● {chosen.availability}</span>
              <span style={{ display: "flex", gap: 16, color: "rgba(243,236,220,0.7)", flexWrap: "wrap" }}>
                <span><Icon name="truck" size={12} color="rgba(243,236,220,0.6)" /> Free standard post over $100</span>
                <span><Icon name="refresh" size={12} color="rgba(243,236,220,0.6)" /> 30-day returns</span>
              </span>
            </div>
            {canBuy && (
              <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "rgba(243,236,220,0.6)" }}>
                Postage is quoted by Australia Post before you pay. Paid securely through Stripe.
              </p>
            )}

            {/* Quiet options: engraving, subscription, size guide. */}
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              {canEngrave && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: CREAM }}>
                  <input type="checkbox" checked={engraveOn} onChange={(e) => setEngraveOn(e.target.checked)} style={{ accentColor: GOLD }} /> Add engraving
                </label>
              )}
              <button style={{ ...btnLink, fontSize: 9 }} onClick={() => navigate(paths.subscribe(frag.slug))}>Subscribe &amp; save 10% <Arrow size={9} /></button>
              <button style={{ ...btnLink, fontSize: 9 }} onClick={() => navigate(paths.about)}>Size guide <Arrow size={9} /></button>
            </div>
            {canEngrave && engraveOn && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  className="mo-engrave-input"
                  value={engraving}
                  maxLength={ENGRAVE_MAX}
                  onChange={(e) => setEngraving(e.target.value)}
                  placeholder="e.g. Happy Birthday, John"
                  aria-label="Engraving text"
                  style={{ flex: 1, minWidth: 0, background: "none", border: 0, borderBottom: "1px solid rgba(201,169,97,0.5)", outline: "none", color: CREAM, fontFamily: SERIF, fontSize: 18, padding: "4px 0" }}
                />
                <span style={{ ...micro, fontSize: 8 }}>{engraving.length} / {ENGRAVE_MAX}</span>
              </div>
            )}

            {/* Other formats, collapsed until wanted. Coming soon never sits beside what can be bought now. */}
            <div style={{ marginTop: 18 }}>
              {extrasLive.length > 0 && (
                <Disclosure title="Also available for car and body" defaultOpen={chosen.def.group !== "wear"}>
                  {extrasLive.map(extraRow)}
                </Disclosure>
              )}
              {extrasSoon.length > 0 && (
                <Disclosure title={`Coming soon in ${frag.name}`}>
                  <p style={{ margin: "0 0 6px", fontSize: 12.5, color: "rgba(243,236,220,0.6)" }}>Tap one to hear when it's ready.</p>
                  {extrasSoon.map(extraRow)}
                </Disclosure>
              )}
            </div>
          </div>
          <SideCaption lines={["Iconic", "scents", "—", "A bolder", "you"]} style={{ paddingTop: 30, borderLeft: "1px solid #1f1f27", paddingLeft: 14, width: 62 }} />
        </div>
      </div>

      {/* ── Step 3: detail on request ── */}
      <section aria-label="About this fragrance" style={{ borderBottom: "1px solid #1f1f27" }}>
        <Container style={{ padding: "8px 32px 18px", maxWidth: 900 }}>
          <Disclosure title="Fragrance notes">
            <div className="mo-notes-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
              {([
                ["Top", frag.top],
                ["Heart", frag.heart],
                ["Base", frag.base],
              ] as const).map(([title, notes]) => (
                <div key={title}>
                  <div style={{ ...micro, color: GOLD, fontSize: 9 }}>{title} notes</div>
                  <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", fontSize: 14, lineHeight: 1.6, color: "rgba(243,236,220,0.85)" }}>
                    {notes.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Disclosure>
          <Disclosure title="How it wears">
            <div style={{ display: "flex", gap: 30, flexWrap: "wrap" }}>
              {experienceOf(frag).map((e) => (
                <IconBadge key={e.label} name={e.icon} label={e.label} />
              ))}
            </div>
          </Disclosure>
          <Disclosure title="Inspiration">
            <InspiredBy {...referenceOf(frag)} size="md" />
            <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.6, color: "rgba(243,236,220,0.75)" }}>{frag.tagline}</p>
          </Disclosure>
          <Disclosure title="Delivery & returns">
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "rgba(243,236,220,0.75)" }}>
              Paid in full at checkout, securely through Stripe — no account needed. Free standard post on orders over $100; otherwise postage is quoted by Australia Post before you pay. Bottles in stock ship within 1–2 business days; those filled to order within 5–7. Returns within 30 days.{" "}
              <a href={paths.help} style={{ color: GOLD }}>Full delivery, payment &amp; returns details</a>
            </p>
          </Disclosure>
        </Container>
      </section>

      {/* ── Step 4: extend the purchase, once the main choice is made ── */}
      {pairings.length > 0 && !locked && (
        <section aria-label="Pair it with" style={{ borderBottom: "1px solid #1f1f27", background: "#0d0d11" }}>
          <Container style={{ padding: "22px 32px 24px" }}>
            <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 26, color: CREAM }}>Make it part of your day</h2>
            <div className="mo-pair-grid" style={{ marginTop: 14, display: "grid", gridTemplateColumns: `repeat(${Math.min(pairings.length, 4)}, 1fr)`, gap: 12 }}>
              {pairings.map((p) => (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "54px 1fr", gap: 12, alignItems: "center", border: "1px solid #1f1f27", background: "#101015", padding: "12px 14px" }}>
                  <span style={{ height: 66, display: "grid", placeItems: "center", background: bottleBackdrop(p.frag.accent, p.frag.liquid) }}>
                    <FormatGlyph formatKey={p.key} liquid={p.frag.liquid} height={50} />
                  </span>
                  <span>
                    <span style={{ display: "block", fontFamily: SERIF, fontSize: 18, color: CREAM }}>{p.title}</span>
                    <span style={{ display: "block", fontSize: 12, color: "rgba(243,236,220,0.55)" }}>{p.note}</span>
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <span style={{ fontFamily: MONO, fontSize: 12.5, color: CREAM }}>{money(p.price)}</span>
                      <button style={{ ...btnLink, fontSize: 9 }} onClick={() => onAdd(p.frag, p.key, 1, null)} aria-label={`Add ${p.title} to bag`}>Add <Arrow size={9} /></button>
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      <Reviews frag={frag} reviews={reviews} summary={rating} enabled={reviewsOn} userId={userId} onSignIn={onSignIn} />

      {/* ── You may also like ── */}
      <section aria-label="You may also like">
        <Container style={{ padding: "22px 32px 60px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 28, color: CREAM }}>You may also like</h2>
            <a href={paths.fragrances} style={{ ...btnLink, textDecoration: "none" }}>Explore more fragrances <Arrow size={10} /></a>
          </div>
          <div className="mo-vault-grid" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {related.map((r) => (
              <FragranceCard key={r.id} frag={r} vip={vip} onQuickView={onQuickView} listName="related" />
            ))}
          </div>
        </Container>
      </section>

      {/* Phones: the purchase stays one tap away once the main button scrolls off. */}
      {stickyOn && (
        <div className="mo-sticky-buy" role="region" aria-label="Quick purchase">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: SERIF, fontSize: 17, color: CREAM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{frag.name}</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: "rgba(243,236,220,0.7)" }}>{chosen.def.name} · {money(chosen.price * qty)}</div>
          </div>
          <button className="mo-cta" style={{ ...btnGold, height: 46, padding: "0 20px" }} onClick={add}>
            <Icon name="bag" size={13} color="#0b0b0d" /> Add to bag
          </button>
        </div>
      )}
    </main>
  );
}
