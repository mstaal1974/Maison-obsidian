import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { type Fragrance, type FormatKey, GOLD, CREAM, money } from "../lib/data";
import { skus, sku as skuOf, profileOf, referenceOf, referenceLine, experienceOf, relatedTo, formatFromParam, type Sku } from "../lib/formats";
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
import "../styles/product.css";

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

// The three perfume sizes lead; everything else is one tap further in.
const CORE: FormatKey[] = ["perf10", "perf30", "perf50"];
const EXTRAS: FormatKey[] = ["car", "wash", "moist", "ritual"];
// With no ?format= asked for, open on the everyday size when it can be bought.
const DEFAULT_ORDER: FormatKey[] = ["perf30", "perf10", "perf50"];
const SIZE_NOTE: Partial<Record<FormatKey, string>> = { perf10: "Try it", perf30: "Everyday", perf50: "Signature" };
const EXTRA_NOTE: Partial<Record<FormatKey, string>> = {
  car: "Drive the scent with you.",
  wash: "Cleanse with character.",
  moist: "Hydrate and layer.",
  ritual: "Four ways to live it.",
};
const ENGRAVE_MAX = 28;
const MUTED = "rgba(243,236,220,0.6)";

/** The story's opening sentence, for the line under the name. */
function firstSentence(s: string): string {
  const m = s.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : s).trim();
}

/**
 * A button that shows and hides the region under it. "section" is a long-form
 * accordion under the fold; "inline" and "quiet" sit in the purchase column,
 * the quiet one for optional extras.
 */
function Disclosure({ label, meta, open, onToggle, variant, children }: { label: ReactNode; meta?: ReactNode; open: boolean; onToggle: () => void; variant: "section" | "inline" | "quiet"; children: ReactNode }) {
  const id = useId();
  const section = variant === "section";
  const button = (
    <button
      type="button"
      id={`${id}-btn`}
      className="mo-pdp-toggle"
      aria-expanded={open}
      aria-controls={`${id}-panel`}
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        background: "none",
        border: 0,
        padding: section ? "18px 0" : variant === "inline" ? "12px 0" : "10px 0",
        cursor: "pointer",
        textAlign: "left",
        ...(section ? { fontFamily: SERIF, fontSize: 26, fontWeight: 400 } : { ...micro, fontSize: variant === "inline" ? 9.5 : 8.5 }),
        color: section ? CREAM : variant === "inline" ? "rgba(243,236,220,0.85)" : MUTED,
      }}
    >
      <span>
        {label}
        {meta && <span style={{ ...micro, fontSize: 8.5, marginLeft: 10, color: GOLD, letterSpacing: "0.16em" }}>{meta}</span>}
      </span>
      <span aria-hidden className="mo-pdp-chevron" style={{ color: GOLD, fontFamily: MONO, fontSize: section ? 16 : 12 }}>▾</span>
    </button>
  );
  return (
    <div style={{ borderTop: `1px solid ${variant === "quiet" ? "#17171d" : "#1f1f27"}` }}>
      {section ? <h2 style={{ margin: 0, font: "inherit" }}>{button}</h2> : button}
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-btn`} hidden={!open} style={{ paddingBottom: section ? 22 : 12 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * The fragrance's world. One page per scent: the perfume sizes up top, the
 * car and body formats one tap further in, and the notes and the story
 * underneath.
 */
export default function ProductDetail({ frag, fragrances, vip, onAdd, onQuickView, userId, userEmail, onSignIn }: ProductDetailProps) {
  // ?format=10ml (or car …) opens the page on that SKU: Shopping listings and
  // the structured data link each price to the page showing it.
  const [key, setKey] = useState<FormatKey>(() => {
    const asked = formatFromParam(new URLSearchParams(window.location.search).get("format"));
    if (asked && skuOf(frag, asked).status === "live") return asked;
    return DEFAULT_ORDER.find((k) => skuOf(frag, k).buyable) ?? "perf50";
  });
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
    // The subscribe link under the add button is always shown.
    trackSubscriptionOfferViewed("product");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frag.id]);
  const chosen = skuOf(frag, key);
  const locked = !!frag.vipOnly && !vip;
  const profile = profileOf(frag);
  const related = useMemo(() => relatedTo(frag, fragrances, 4), [frag, fragrances]);

  // Buyable perfume sizes; buyable car and body formats; and everything that
  // can't be bought yet (coming soon, or body care that has sold out).
  const sizes = CORE.map((k) => skuOf(frag, k)).filter((s) => s.buyable);
  const extras = EXTRAS.map((k) => skuOf(frag, k)).filter((s) => s.buyable);
  const later = skus(frag).filter((s) => !s.buyable);

  // A link to the car diffuser (or a sold-out size) opens its drawer.
  const [extrasOpen, setExtrasOpen] = useState(() => extras.some((s) => s.key === key));
  const [laterOpen, setLaterOpen] = useState(() => later.some((s) => s.key === key));
  const [pairOpen, setPairOpen] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ notes: true });
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const select = (k: FormatKey) => {
    if (k === key) return;
    setKey(k);
    trackFormatSelected({ id: frag.id, name: frag.name, format: k, priceCents: skuOf(frag, k).price }, "product");
  };

  // "Pair it with": the same scent in another format, and a 10ml of the
  // closest related scent to try. Ticked add-ons go in the bag with the main
  // item.
  const [addOns, setAddOns] = useState<Set<string>>(new Set());
  const pairings = useMemo(() => {
    const out: { id: string; frag: Fragrance; key: FormatKey; title: string; note: string; price: number }[] = [];
    for (const k of ["car", "wash", "moist"] as FormatKey[]) {
      const s = skuOf(frag, k);
      if (k !== key && s.buyable) out.push({ id: k, frag, key: k, title: `${frag.name} ${s.def.label}`, note: k === "car" ? "Take the scent with you" : "Layer the scent", price: s.price });
    }
    const other = related.find((r) => !(r.vipOnly && !vip) && skuOf(r, "perf10").buyable);
    if (other) out.push({ id: `sample:${other.id}`, frag: other, key: "perf10", title: `${other.name} 10ml`, note: "Try the closest match to this scent", price: skuOf(other, "perf10").price });
    return out;
  }, [frag, key, related, vip]);
  const pickedPairings = pairings.filter((p) => addOns.has(p.id));
  const addWithPairings = () => {
    onAdd(frag, key, qty, finalEngraving);
    for (const p of pickedPairings) onAdd(p.frag, p.key, 1, null);
    setAddOns(new Set());
  };

  const canEngrave = chosen.def.group === "wear";
  const finalEngraving = canEngrave && engraveOn ? engraving.trim().slice(0, ENGRAVE_MAX) || null : null;
  const canPair = pairings.length > 0 && chosen.buyable && !locked;
  const addLabel = pickedPairings.length ? `Add ${pickedPairings.length + 1} to bag` : "Add to bag";

  // Phones: once the add button scrolls up out of view, a bar at the foot of
  // the screen carries the same add (product.css shows it under 720px).
  const ctaRef = useRef<HTMLButtonElement>(null);
  const [pastCta, setPastCta] = useState(false);
  // Measured on scroll rather than by IntersectionObserver, which stays quiet
  // when a fling or jump carries the button from below the fold to above it.
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = ctaRef.current;
      setPastCta(!!el && el.getBoundingClientRect().bottom < 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  const showSticky = pastCta && chosen.buyable && !locked;

  const price = (s: Sku) => (
    <>
      {money(s.price)}
      {s.compareAt && <s style={{ marginLeft: 8, color: "rgba(243,236,220,0.4)" }}>{money(s.compareAt)}</s>}
    </>
  );

  // One perfume size: 10ml "Try it" / 30ml "Everyday" / 50ml "Signature".
  const sizeButton = (s: Sku) => {
    const active = s.key === key;
    return (
      <button
        key={s.key}
        type="button"
        className="mo-pdp-size"
        onClick={() => select(s.key)}
        aria-pressed={active}
        title={s.availability}
        style={{
          background: active ? "rgba(201,169,97,0.1)" : "#0c0c10",
          border: `1px solid ${active ? GOLD : "#2a2a33"}`,
          padding: "12px 8px 10px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          color: CREAM,
          minWidth: 0,
        }}
      >
        <span style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1 }}>{s.def.label}</span>
        <span style={{ ...micro, fontSize: 8, color: active ? GOLD : MUTED, letterSpacing: "0.18em" }}>{SIZE_NOTE[s.key]}</span>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: "rgba(243,236,220,0.9)", marginTop: 2 }}>{money(s.price)}</span>
      </button>
    );
  };

  // A car / body format, or a coming-soon one, as a compact row.
  const formatRow = (s: Sku) => {
    const soon = s.status === "coming_soon";
    const active = !soon && s.key === key;
    return (
      <button
        key={s.key}
        type="button"
        className="mo-pdp-row"
        onClick={() => (soon ? setNotifyKey((k) => (k === s.key ? null : s.key)) : select(s.key))}
        aria-pressed={soon ? undefined : active}
        aria-expanded={soon ? notifyKey === s.key : undefined}
        aria-controls={soon ? "pdp-notify" : undefined}
        title={s.availability}
        style={{
          display: "grid",
          gridTemplateColumns: "40px 1fr auto",
          gap: 12,
          alignItems: "center",
          width: "100%",
          textAlign: "left",
          background: active ? "rgba(201,169,97,0.1)" : "none",
          border: `1px solid ${active || (soon && notifyKey === s.key) ? GOLD : "#1f1f27"}`,
          padding: "8px 12px",
          cursor: "pointer",
          color: CREAM,
        }}
      >
        <span style={{ display: "grid", placeItems: "center" }}>
          <FormatGlyph formatKey={s.key} liquid={frag.liquid} height={s.key === "ritual" ? 24 : 38} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: SERIF, fontSize: 17 }}>{s.def.name}</span>
          <span style={{ display: "block", fontSize: 12, color: MUTED, marginTop: 2 }}>{soon ? "Coming soon" : !s.buyable ? s.availability : EXTRA_NOTE[s.key] ?? SIZE_NOTE[s.key]}</span>
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11.5, whiteSpace: "nowrap", color: soon ? GOLD : CREAM }}>
          {soon ? (notified.has(s.key) ? "On the list ✓" : "Notify me") : price(s)}
        </span>
      </button>
    );
  };

  return (
    <main data-screen-label="Product" className="mo-pdp">
      {/* ── Top: hero image + purchase column ── */}
      <div className="mo-pdp-grid" style={{ display: "grid", gridTemplateColumns: "0.72fr 1.28fr", borderBottom: "1px solid #1f1f27" }}>
        {/* HERO IMAGE */}
        <div className="mo-pdp-image" style={{ borderRight: "1px solid #1f1f27", padding: "18px 24px 22px 32px" }}>
          <div style={{ position: "relative", background: bottleBackdrop(frag.accent, frag.liquid), border: "1px solid #1f1f27" }}>
            <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-pdp.jpg" alt={`${frag.name} bottle`} accent={frag.accent} liquid={frag.liquid} height="var(--pdp-image-h, 548px)" objectPosition="center 45%" />
            <SideCaption overlay lines={[...profile, "—", "A bolder", "you"]} style={{ position: "absolute", left: 18, top: 20, background: "rgba(11,11,13,0.55)", padding: "10px 12px", backdropFilter: "blur(2px)" }} />
          </div>
        </div>

        {/* PURCHASE */}
        <div className="mo-pdp-details" style={{ padding: "18px 32px 26px 30px" }}>
          <div style={{ minWidth: 0, maxWidth: 640 }}>
            <nav aria-label="Breadcrumb" style={{ ...micro, fontSize: 8.5, display: "flex", gap: 6 }}>
              <a href={paths.home} style={{ ...btnLink, color: "rgba(243,236,220,0.5)", fontSize: 8.5, textDecoration: "none" }}>Home</a> /
              <a href={paths.fragrances} style={{ ...btnLink, color: "rgba(243,236,220,0.5)", fontSize: 8.5, textDecoration: "none" }}>Fragrances</a> /
              <span style={{ color: "rgba(243,236,220,0.8)" }}>{frag.name}</span>
            </nav>
            <h1 className="mo-pdp-title" style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 54, lineHeight: 1, color: CREAM }}>{frag.name}</h1>
            <div style={{ marginTop: 14 }}><InspiredBy {...referenceOf(frag)} size="lg" /></div>
            <div style={{ ...micro, color: GOLD, marginTop: 12, letterSpacing: "0.34em", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {isNew(frag) && <span style={{ color: "#0b0b0d", background: GOLD, padding: "3px 8px", letterSpacing: "0.2em", fontWeight: 600 }}>New arrival</span>}
              <span>{profile.join(" · ")}</span>
            </div>
            {rating && (
              <a href="#reviews" onClick={(e) => { e.preventDefault(); document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" }); }} style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 12.5, color: CREAM, textDecoration: "none" }}>
                <Stars value={rating.average} /> {rating.average.toFixed(1)} · {rating.count} {rating.count === 1 ? "review" : "reviews"}
              </a>
            )}
            <p style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.45, color: "rgba(243,236,220,0.78)" }}>{firstSentence(frag.story)}</p>

            {/* Price of what's selected */}
            <div style={{ marginTop: 20, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontFamily: MONO, fontSize: 22, color: CREAM }}>{price(chosen)}</span>
              <span style={{ fontSize: 12.5, color: MUTED, letterSpacing: "0.04em" }}>{chosen.def.name}</span>
            </div>

            {/* Size */}
            {sizes.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 16 }}>
                  <span id="pdp-size-label" style={{ ...micro, color: CREAM }}>Size</span>
                  <button type="button" style={{ ...btnLink, fontSize: 8.5, color: MUTED }} onClick={() => navigate(paths.about)}>Size guide <Arrow size={9} /></button>
                </div>
                <div role="group" aria-labelledby="pdp-size-label" className="mo-pdp-sizes" style={{ marginTop: 8, display: "grid", gridTemplateColumns: `repeat(${sizes.length}, minmax(0, 1fr))`, gap: 8, maxWidth: 420 }}>
                  {sizes.map(sizeButton)}
                </div>
              </>
            )}

            {/* Quantity + add + wishlist */}
            <div className="mo-pdp-buy" style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #2a2a33", height: 52 }}>
                <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 44, height: "100%", background: "none", border: 0, color: CREAM, cursor: "pointer", fontSize: 18 }}>−</button>
                <span style={{ fontFamily: MONO, fontSize: 14, color: CREAM, minWidth: 28, textAlign: "center" }}>{qty}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(9, q + 1))} style={{ width: 44, height: "100%", background: "none", border: 0, color: CREAM, cursor: "pointer", fontSize: 18 }}>+</button>
              </div>
              <button
                ref={ctaRef}
                type="button"
                className="mo-cta"
                style={{ ...btnGold, height: 52, padding: "0 48px", fontSize: 12.5, letterSpacing: "0.28em", justifyContent: "center", opacity: chosen.buyable && !locked ? 1 : 0.5 }}
                disabled={!chosen.buyable || locked}
                onClick={addWithPairings}
              >
                <Icon name="bag" size={14} color="#0b0b0d" /> {locked ? "VIP members only" : !chosen.buyable ? (chosen.status === "coming_soon" ? "Coming soon" : "Sold out") : addLabel}
              </button>
              <button type="button" aria-label="Save to wishlist" style={{ width: 52, height: 52, border: "1px solid rgba(201,169,97,0.5)", background: "none", cursor: "pointer", display: "grid", placeItems: "center" }}>
                <Icon name="heart" size={16} />
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 10, flexWrap: "wrap", ...micro, fontSize: 8.5 }}>
              <span style={{ color: chosen.status === "live" && (chosen.stock > 0 || chosen.def.group === "wear") ? "#8bb98a" : GOLD }}>
                ● {chosen.availability}
              </span>
              <span style={{ display: "flex", gap: 18 }}>
                <span><Icon name="truck" size={12} color={MUTED} /> Free standard post over $100</span>
                <span><Icon name="refresh" size={12} color={MUTED} /> 30-day returns</span>
              </span>
            </div>

            {/* One tap further in: car and body, coming soon, a pairing or engraving, the subscription */}
            <div style={{ marginTop: 16 }}>
              {/* Car and body formats */}
              {extras.length > 0 && (
                <Disclosure variant="inline" open={extrasOpen} onToggle={() => setExtrasOpen((o) => !o)} label="Also available for car and body">
                  <div style={{ display: "grid", gap: 8 }}>{extras.map(formatRow)}</div>
                  <button type="button" style={{ ...btnLink, fontSize: 8.5, marginTop: 10 }} onClick={() => onQuickView(frag)}>Compare all formats <Arrow size={9} /></button>
                </Disclosure>
              )}

              {/* Not buyable yet: waitlist, or sold out */}
              {later.length > 0 && (
                <Disclosure variant="inline" open={laterOpen} onToggle={() => setLaterOpen((o) => !o)} label={later.every((s) => s.status === "coming_soon") ? "Coming soon" : "Coming soon & sold out"}>
                  <div style={{ display: "grid", gap: 8 }}>{later.map(formatRow)}</div>
                  {notifyKey && (
                    <div id="pdp-notify" style={{ marginTop: 10, border: "1px solid #2a2a33", background: "#0c0c10", padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                        <div style={{ fontFamily: SERIF, fontSize: 19, color: CREAM }}>
                          {frag.name} {skuOf(frag, notifyKey).def.name} is coming soon
                        </div>
                        <button type="button" aria-label="Close" onClick={() => setNotifyKey(null)} style={{ ...btnLink, color: "rgba(243,236,220,0.5)", fontSize: 16 }}>×</button>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <NotifyMe
                          key={notifyKey}
                          fragranceId={frag.id}
                          format={notifyKey}
                          defaultEmail={userEmail}
                          note="One email when it's ready, nothing else."
                          onDone={() => setNotified((n) => new Set(n).add(notifyKey))}
                        />
                      </div>
                    </div>
                  )}
                </Disclosure>
              )}

              {(canPair || canEngrave) && (
                <Disclosure
                  variant="quiet"
                  open={pairOpen}
                  onToggle={() => setPairOpen((o) => !o)}
                  label={canPair && canEngrave ? "Add a pairing or engraving" : canPair ? "Add a pairing" : "Add an engraving"}
                  meta={[pickedPairings.length ? `${pickedPairings.length} paired` : "", finalEngraving ? "Engraved" : ""].filter(Boolean).join(" · ") || undefined}
                >
                  {canPair && (
                    <fieldset style={{ margin: 0, border: 0, padding: 0 }}>
                      <legend style={{ ...micro, fontSize: 8, padding: 0, color: MUTED }}>Pair it with · added with your main item</legend>
                      {pairings.map((p) => (
                        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1px solid #17171d", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={addOns.has(p.id)}
                            onChange={(e) =>
                              setAddOns((cur) => {
                                const next = new Set(cur);
                                if (e.target.checked) next.add(p.id);
                                else next.delete(p.id);
                                return next;
                              })
                            }
                            style={{ accentColor: GOLD, width: 15, height: 15 }}
                          />
                          <span style={{ width: 26, height: 32, flexShrink: 0, display: "grid", placeItems: "center", background: bottleBackdrop(p.frag.accent, p.frag.liquid), border: "1px solid #1f1f27" }}>
                            <FormatGlyph formatKey={p.key} liquid={p.frag.liquid} height={24} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontFamily: SERIF, fontSize: 15, color: "rgba(243,236,220,0.85)" }}>{p.title}</span>
                            <span style={{ display: "block", fontSize: 11.5, color: "rgba(243,236,220,0.5)" }}>{p.note}</span>
                          </span>
                          <span style={{ fontFamily: MONO, fontSize: 11.5, color: "rgba(243,236,220,0.75)" }}>+{money(p.price)}</span>
                        </label>
                      ))}
                    </fieldset>
                  )}

                  {canEngrave && (
                    <div style={{ marginTop: canPair ? 10 : 0, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", ...micro, fontSize: 8.5, color: "rgba(243,236,220,0.75)" }}>
                        <input type="checkbox" checked={engraveOn} onChange={(e) => setEngraveOn(e.target.checked)} /> Custom engraving
                      </label>
                      {engraveOn && (
                        <>
                          <input
                            className="mo-engrave-input"
                            value={engraving}
                            maxLength={ENGRAVE_MAX}
                            onChange={(e) => setEngraving(e.target.value)}
                            placeholder="e.g. Happy Birthday, John"
                            aria-label="Engraving text"
                            style={{ flex: 1, minWidth: 200, background: "none", border: 0, borderBottom: "1px solid rgba(201,169,97,0.5)", outline: "none", color: CREAM, fontFamily: SERIF, fontSize: 16, padding: "4px 0" }}
                          />
                          <span style={{ ...micro, fontSize: 8 }}>{engraving.length} / {ENGRAVE_MAX}</span>
                        </>
                      )}
                    </div>
                  )}
                </Disclosure>
              )}

              <div style={{ borderTop: "1px solid #17171d", paddingTop: 12 }}>
                <button type="button" style={{ ...btnLink, fontSize: 8.5, color: MUTED }} onClick={() => navigate(paths.subscribe(frag.slug))}>
                  Subscribe &amp; save 10% <Arrow size={9} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── The long read: notes, story, how it wears, delivery ── */}
      <section aria-label="About this fragrance" style={{ borderBottom: "1px solid #1f1f27", background: "#0d0d11" }}>
        <Container style={{ padding: "6px 32px 10px" }}>
          <div style={{ maxWidth: 1000 }}>
            <Disclosure variant="section" open={!!open.notes} onToggle={() => toggle("notes")} label="Fragrance notes">
              <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.6, color: MUTED }}>{frag.tagline} A composition of rare elements, balanced to perfection.</p>
              <div className="mo-pdp-notes" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 22 }}>
                {([
                  ["Top notes", frag.top, `linear-gradient(135deg, ${frag.accent}66, #1a1410)`],
                  ["Heart notes", frag.heart, `linear-gradient(135deg, ${frag.liquid}, #2c1a0c)`],
                  ["Base notes", frag.base, "linear-gradient(135deg, #3b2a18, #0e0e12)"],
                ] as const).map(([title, notes, bg]) => (
                  <div key={title} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 14, alignItems: "center" }}>
                    <span aria-hidden style={{ height: 72, background: bg, border: "1px solid #1f1f27" }} />
                    <div>
                      <h3 style={{ ...micro, margin: 0, fontWeight: 400, color: CREAM, fontSize: 9 }}>{title}</h3>
                      <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", fontSize: 13.5, lineHeight: 1.5, color: "rgba(243,236,220,0.85)" }}>
                        {notes.map((n) => <li key={n}>{n}</li>)}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </Disclosure>

            <Disclosure variant="section" open={!!open.story} onToggle={() => toggle("story")} label="The story">
              <p style={{ margin: 0, fontFamily: SERIF, fontSize: 18, lineHeight: 1.5, color: "rgba(243,236,220,0.8)", maxWidth: 680 }}>{frag.story}</p>
              <p style={{ margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.6, color: MUTED }}>{referenceLine(frag)}.</p>
            </Disclosure>

            <Disclosure variant="section" open={!!open.wear} onToggle={() => toggle("wear")} label="How it wears">
              <div style={{ display: "flex", gap: 34, flexWrap: "wrap" }}>
                {experienceOf(frag).map((e) => (
                  <IconBadge key={e.label} name={e.icon} label={e.label} />
                ))}
              </div>
            </Disclosure>

            <Disclosure variant="section" open={!!open.delivery} onToggle={() => toggle("delivery")} label="Delivery & returns">
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "rgba(243,236,220,0.7)", maxWidth: 680 }}>
                Paid in full at checkout, securely through Stripe. Postage is quoted by Australia Post before you pay
                {chosen.buyable && !locked
                  ? <>; this {chosen.def.group === "drive" ? "diffuser" : "bottle"} {chosen.stock > 0 ? "ships within 1–2 business days" : "is filled to order and ships within 5–7 business days"}.</>
                  : "."}{" "}
                Free standard post over $100, and 30-day returns.{" "}
                <a href={paths.help} style={{ color: GOLD }}>Delivery, payment &amp; returns</a>
              </p>
            </Disclosure>
          </div>
        </Container>
      </section>

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
              <FragranceCard key={r.id} frag={r} vip={vip} onQuickView={onQuickView} />
            ))}
          </div>
        </Container>
      </section>

      {/* ── Phones: sticky add, once the main button has scrolled away ── */}
      <div
        className="mo-pdp-sticky"
        data-show={showSticky ? "true" : "false"}
        role="region"
        aria-label={`Add ${frag.name} to bag`}
        style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 80, alignItems: "center", gap: 12, background: "rgba(11,11,13,0.96)", borderTop: "1px solid #2a2a33", padding: "10px 16px calc(10px + env(safe-area-inset-bottom, 0px))", backdropFilter: "blur(6px)" }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SERIF, fontSize: 17, color: CREAM, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{frag.name}</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED, marginTop: 3 }}>{chosen.def.short} · <span style={{ color: CREAM }}>{money(chosen.price)}</span>{qty > 1 ? ` × ${qty}` : ""}</div>
        </div>
        <button type="button" className="mo-cta" style={{ ...btnGold, height: 46, padding: "0 20px", fontSize: 11 }} onClick={addWithPairings}>
          <Icon name="bag" size={13} color="#0b0b0d" /> {addLabel}
        </button>
      </div>
    </main>
  );
}
