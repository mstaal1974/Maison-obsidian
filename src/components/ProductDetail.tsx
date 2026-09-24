import { useMemo, useState } from "react";
import { type Fragrance, type FormatKey, GOLD, CREAM, money } from "../lib/data";
import { GROUPS, type FormatGroup, skusInGroup, sku as skuOf, profileOf, referenceOf, experienceOf, relatedTo, type Sku } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import { productMeta, usePageMeta } from "../lib/seo";
import { summarise, useReviews } from "../lib/reviews";
import { isNew } from "../lib/launch";
import Reviews, { Stars } from "./Reviews";
import BottleImage from "./BottleImage";
import FragranceCard from "./FragranceCard";
import NotifyMe from "./NotifyMe";
import { bottleBackdrop } from "./adminStyles";
import { FormatGlyph } from "./ProductGlyphs";
import { Arrow, Container, Icon, IconBadge, SideCaption, Chip, InspiredBy } from "./ui";
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

const ORDER: FormatGroup[] = ["wear", "drive", "live", "ritual"];
const ENGRAVE_MAX = 28;

/**
 * The fragrance's world. One page per scent; the customer chooses how to
 * experience it — Wear it / Drive with it / Live in it / Complete the ritual —
 * and reads the notes and the story underneath.
 */
export default function ProductDetail({ frag, fragrances, vip, onAdd, onQuickView, userId, userEmail, onSignIn }: ProductDetailProps) {
  const [key, setKey] = useState<FormatKey>("perf50");
  const [qty, setQty] = useState(1);
  const [engraveOn, setEngraveOn] = useState(false);
  const [engraving, setEngraving] = useState("");
  // Coming-soon formats: which one's Notify me form is open, and which this
  // visitor has joined the waitlist for.
  const [notifyKey, setNotifyKey] = useState<FormatKey | null>(null);
  const [notified, setNotified] = useState<Set<FormatKey>>(new Set());
  const { reviews, enabled: reviewsOn } = useReviews(frag.id);
  const rating = useMemo(() => summarise(reviews), [reviews]);
  usePageMeta(useMemo(() => productMeta(frag, window.location.origin, frag.imageUrl, rating), [frag, rating]));
  const chosen = skuOf(frag, key);
  const locked = !!frag.vipOnly && !vip;
  const profile = profileOf(frag);
  const related = useMemo(() => relatedTo(frag, fragrances, 4), [frag, fragrances]);

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

  const option = (s: Sku) => {
    const active = s.key === key;
    const soon = s.status === "coming_soon";
    const wide = s.key === "ritual";
    return (
      <button
        key={s.key}
        onClick={() => (soon ? setNotifyKey((k) => (k === s.key ? null : s.key)) : setKey(s.key))}
        aria-pressed={soon ? notifyKey === s.key : active}
        aria-expanded={soon ? notifyKey === s.key : undefined}
        title={s.availability}
        style={{
          background: "none",
          border: `1px solid ${active || (soon && notifyKey === s.key) ? GOLD : "transparent"}`,
          padding: wide ? "8px 10px 6px" : "8px 4px 6px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          minWidth: wide ? 150 : 64,
          color: CREAM,
          opacity: soon ? 0.75 : 1,
        }}
      >
        <span style={{ height: 84, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <FormatGlyph formatKey={s.key} liquid={frag.liquid} height={s.key === "perf10" ? 68 : s.key === "perf30" ? 72 : s.key === "ritual" ? 70 : 84} />
        </span>
        <span style={{ fontSize: 11.5, lineHeight: 1.25, textAlign: "center", letterSpacing: "0.03em", maxWidth: wide ? 170 : 80 }}>
          {s.key === "perf10" ? <>10ml<br />Discovery</> : s.key === "ritual" ? <>The Complete Ritual<br />(4 Pieces)</> : s.def.label}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: soon ? GOLD : "rgba(243,236,220,0.9)", letterSpacing: "0.02em" }}>
          {soon ? (notified.has(s.key) ? "On the list ✓" : "Notify me") : (
            <>
              {money(s.price)}
              {s.compareAt && <s style={{ marginLeft: 8, color: "rgba(243,236,220,0.4)" }}>{money(s.compareAt)}</s>}
            </>
          )}
        </span>
      </button>
    );
  };

  const alsoAvailable = (["car", "wash", "moist", "ritual"] as FormatKey[]).map((k) => skuOf(frag, k)).filter((s) => s.status !== "hidden");

  return (
    <main data-screen-label="Product">
      {/* ── Top: hero image + details ── */}
      <div className="mo-pdp-grid" style={{ display: "grid", gridTemplateColumns: "0.72fr 1.28fr", borderBottom: "1px solid #1f1f27" }}>
        {/* HERO IMAGE */}
        <div className="mo-pdp-image" style={{ borderRight: "1px solid #1f1f27", padding: "18px 24px 22px 32px" }}>
          <div style={{ position: "relative", background: bottleBackdrop(frag.accent, frag.liquid), border: "1px solid #1f1f27" }}>
            <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-pdp.jpg" alt={`${frag.name} bottle`} accent={frag.accent} liquid={frag.liquid} height="var(--pdp-image-h, 548px)" objectPosition="center 45%" />
            <SideCaption overlay lines={[...profile, "—", "A bolder", "you"]} style={{ position: "absolute", left: 18, top: 20, background: "rgba(11,11,13,0.55)", padding: "10px 12px", backdropFilter: "blur(2px)" }} />
          </div>
        </div>

        {/* DETAILS */}
        <div className="mo-pdp-details" style={{ padding: "18px 32px 26px 30px", display: "grid", gridTemplateColumns: "1fr auto", gap: 18 }}>
          <div style={{ minWidth: 0 }}>
            <nav aria-label="Breadcrumb" style={{ ...micro, fontSize: 8.5, display: "flex", gap: 6 }}>
              <button style={{ ...btnLink, color: "rgba(243,236,220,0.5)", fontSize: 8.5 }} onClick={() => navigate(paths.home)}>Home</button> /
              <button style={{ ...btnLink, color: "rgba(243,236,220,0.5)", fontSize: 8.5 }} onClick={() => navigate(paths.fragrances)}>Fragrances</button> /
              <span style={{ color: "rgba(243,236,220,0.8)" }}>{frag.name}</span>
            </nav>
            <h1 className="mo-pdp-title" style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 54, lineHeight: 1, color: CREAM }}>{frag.name}</h1>
            <div style={{ ...micro, color: GOLD, marginTop: 10, letterSpacing: "0.34em", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {isNew(frag) && <span style={{ color: "#0b0b0d", background: GOLD, padding: "3px 8px", letterSpacing: "0.2em", fontWeight: 600 }}>New arrival</span>}
              <span>{profile.join(" · ")}</span>
            </div>
            {rating && (
              <a href="#reviews" onClick={(e) => { e.preventDefault(); document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" }); }} style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 12.5, color: CREAM, textDecoration: "none" }}>
                <Stars value={rating.average} /> {rating.average.toFixed(1)} · {rating.count} {rating.count === 1 ? "review" : "reviews"}
              </a>
            )}
            <div style={{ marginTop: 14 }}><InspiredBy {...referenceOf(frag)} size="lg" /></div>
            <p style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.45, color: "rgba(243,236,220,0.78)", maxWidth: 620 }}>{frag.story}</p>

            <div style={{ display: "flex", gap: 34, marginTop: 20, flexWrap: "wrap" }}>
              {experienceOf(frag).map((e) => (
                <IconBadge key={e.label} name={e.icon} label={e.label} />
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 26 }}>
              <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 24, color: CREAM }}>Choose your format</h2>
              <span style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <button style={btnLink} onClick={() => navigate(paths.subscribe(frag.slug))}>Subscribe monthly · save 10% <Arrow size={10} /></button>
                <button style={btnLink} onClick={() => navigate(paths.about)}>Size guide <Arrow size={10} /></button>
              </span>
            </div>
            <div className="mo-formats-grid" style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch" }}>
              {ORDER.map((g) => {
                const list = skusInGroup(frag, g);
                if (!list.length) return null;
                return (
                  <div key={g} style={{ border: "1px solid #2a2a33", padding: "12px 10px 10px", background: "#0c0c10", flex: "0 0 auto" }}>
                    <div style={{ fontFamily: SERIF, fontSize: 13.5, letterSpacing: "0.1em", textTransform: "uppercase", color: CREAM, whiteSpace: "nowrap" }}>{GROUPS[g].title}</div>
                    <div style={{ ...micro, fontSize: 8, marginTop: 3, color: "rgba(243,236,220,0.6)" }}>{GROUPS[g].sub}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 8, justifyContent: "center" }}>{list.map(option)}</div>
                  </div>
                );
              })}
            </div>

            {notifyKey && (
              <div style={{ marginTop: 12, border: "1px solid #2a2a33", background: "#0c0c10", padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 19, color: CREAM }}>
                    {frag.name} {skuOf(frag, notifyKey).def.name} is coming soon
                  </div>
                  <button aria-label="Close" onClick={() => setNotifyKey(null)} style={{ ...btnLink, color: "rgba(243,236,220,0.5)", fontSize: 16 }}>×</button>
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

            {/* Summary + add */}
            <div style={{ marginTop: 18, borderTop: "1px solid #1f1f27", paddingTop: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 220 }}>
                <span style={{ width: 62, height: 78, flexShrink: 0, display: "grid", placeItems: "center", background: bottleBackdrop(frag.accent, frag.liquid), border: "1px solid #1f1f27" }}>
                  {frag.imageUrl ? <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-square.jpg" alt="" accent={frag.accent} liquid={frag.liquid} height={76} /> : <FormatGlyph formatKey={key} liquid={frag.liquid} height={64} />}
                </span>
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 22, color: CREAM, lineHeight: 1 }}>{frag.name}</div>
                  <div style={{ fontSize: 12.5, color: "rgba(243,236,220,0.6)", marginTop: 4, letterSpacing: "0.04em" }}>{chosen.def.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 14, color: CREAM, marginTop: 4 }}>{money(chosen.price)}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #2a2a33", height: 52, marginLeft: "auto" }}>
                <button aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 44, height: "100%", background: "none", border: 0, color: CREAM, cursor: "pointer", fontSize: 18 }}>−</button>
                <span style={{ fontFamily: MONO, fontSize: 14, color: CREAM, minWidth: 28, textAlign: "center" }}>{qty}</span>
                <button aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(9, q + 1))} style={{ width: 44, height: "100%", background: "none", border: 0, color: CREAM, cursor: "pointer", fontSize: 18 }}>+</button>
              </div>
              <button
                className="mo-cta"
                style={{ ...btnGold, height: 52, padding: "0 56px", fontSize: 12.5, letterSpacing: "0.28em", opacity: chosen.buyable && !locked ? 1 : 0.5 }}
                disabled={!chosen.buyable || locked}
                onClick={addWithPairings}
              >
                <Icon name="bag" size={14} color="#0b0b0d" /> {locked ? "VIP members only" : !chosen.buyable ? (chosen.status === "coming_soon" ? "Coming soon" : "Sold out") : pickedPairings.length ? `Add ${pickedPairings.length + 1} to bag` : "Add to bag"}
              </button>
              <button aria-label="Save to wishlist" style={{ width: 52, height: 52, border: "1px solid rgba(201,169,97,0.5)", background: "none", cursor: "pointer", display: "grid", placeItems: "center" }}>
                <Icon name="heart" size={16} />
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 10, flexWrap: "wrap", ...micro, fontSize: 8.5 }}>
              <span style={{ color: chosen.status === "live" && (chosen.stock > 0 || chosen.def.group === "wear") ? "#8bb98a" : GOLD }}>
                ● {chosen.availability}

              </span>
              <span style={{ display: "flex", gap: 18 }}>
                <span><Icon name="truck" size={12} color="rgba(243,236,220,0.6)" /> Free shipping over $100</span>
                <span><Icon name="refresh" size={12} color="rgba(243,236,220,0.6)" /> 30-day returns</span>
              </span>
            </div>

            {pairings.length > 0 && chosen.buyable && !locked && (
              <fieldset style={{ margin: "16px 0 0", border: "1px solid #1f1f27", padding: "12px 14px 6px" }}>
                <legend style={{ ...micro, fontSize: 8.5, padding: "0 6px", color: GOLD }}>Pair it with</legend>
                {pairings.map((p) => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderTop: "1px solid #17171d", cursor: "pointer" }}>
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
                      style={{ accentColor: GOLD, width: 16, height: 16 }}
                    />
                    <span style={{ width: 34, height: 42, flexShrink: 0, display: "grid", placeItems: "center", background: bottleBackdrop(p.frag.accent, p.frag.liquid), border: "1px solid #1f1f27" }}>
                      <FormatGlyph formatKey={p.key} liquid={p.frag.liquid} height={32} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: SERIF, fontSize: 17, color: CREAM }}>{p.title}</span>
                      <span style={{ display: "block", fontSize: 12, color: "rgba(243,236,220,0.55)" }}>{p.note}</span>
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 13, color: CREAM }}>+{money(p.price)}</span>
                  </label>
                ))}
              </fieldset>
            )}

            {canEngrave && (
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", ...micro, color: CREAM }}>
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
                      style={{ flex: 1, minWidth: 220, background: "none", border: 0, borderBottom: "1px solid rgba(201,169,97,0.5)", outline: "none", color: CREAM, fontFamily: SERIF, fontSize: 18, padding: "4px 0" }}
                    />
                    <span style={{ ...micro, fontSize: 8 }}>{engraving.length} / {ENGRAVE_MAX}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <SideCaption lines={["Iconic", "scents", "—", "A bolder", "you"]} style={{ paddingTop: 30, borderLeft: "1px solid #1f1f27", paddingLeft: 14, width: 62 }} />
        </div>
      </div>

      {/* ── Fragrance notes ── */}
      <section aria-label="Fragrance notes" style={{ borderBottom: "1px solid #1f1f27", background: "#0d0d11" }}>
        <Container style={{ padding: "22px 32px" }}>
          <div className="mo-notes-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr 1fr auto", gap: 22, alignItems: "center" }}>
            <div style={{ borderRight: "1px solid #1f1f27", paddingRight: 22 }}>
              <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 32, color: CREAM }}>Fragrance notes</h2>
              <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: "rgba(243,236,220,0.6)" }}>{frag.tagline} A composition of rare elements, balanced to perfection.</p>
            </div>
            {([
              ["Top notes", frag.top, `linear-gradient(135deg, ${frag.accent}66, #1a1410)`],
              ["Heart notes", frag.heart, `linear-gradient(135deg, ${frag.liquid}, #2c1a0c)`],
              ["Base notes", frag.base, "linear-gradient(135deg, #3b2a18, #0e0e12)"],
            ] as const).map(([title, notes, bg]) => (
              <div key={title} style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 16, alignItems: "center" }}>
                <span aria-hidden style={{ height: 88, background: bg, border: "1px solid #1f1f27" }} />
                <div>
                  <div style={{ ...micro, color: CREAM, fontSize: 9 }}>{title}</div>
                  <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", fontSize: 13.5, lineHeight: 1.5, color: "rgba(243,236,220,0.85)" }}>
                    {notes.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                </div>
              </div>
            ))}
            <SideCaption lines={["Depth", "in every", "layer"]} style={{ borderLeft: "1px solid #1f1f27", paddingLeft: 22 }} />
          </div>
        </Container>
      </section>

      {/* ── Also available in ── */}
      {alsoAvailable.length > 0 && (
        <section aria-label={`Also available in ${frag.name}`} style={{ borderBottom: "1px solid #1f1f27" }}>
          <Container style={{ padding: "22px 32px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 28, color: CREAM }}>Also available in {frag.name}</h2>
              <button style={btnLink} onClick={() => onQuickView(frag)}>View all formats <Arrow size={10} /></button>
            </div>
            <div className="mo-also-grid" style={{ marginTop: 14, display: "grid", gridTemplateColumns: `repeat(${alsoAvailable.length}, 1fr)`, gap: 12 }}>
              {alsoAvailable.map((s) => (
                <button
                  key={s.key}
                  onClick={() => { if (s.status === "coming_soon") setNotifyKey(s.key); else setKey(s.key); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 14, alignItems: "center", border: "1px solid #1f1f27", background: "#101015", padding: 0, textAlign: "left", cursor: "pointer", color: CREAM, minHeight: 116 }}
                >
                  <span style={{ height: "100%", background: bottleBackdrop(frag.accent, frag.liquid), display: "grid", placeItems: "center", borderRight: "1px solid #1f1f27", padding: 8 }}>
                    <FormatGlyph formatKey={s.key} liquid={frag.liquid} height={s.key === "ritual" ? 50 : 76} />
                  </span>
                  <span style={{ padding: "12px 14px 12px 0" }}>
                    <span style={{ display: "block", fontFamily: SERIF, fontSize: 21 }}>{s.def.label}</span>
                    <span style={{ display: "block", fontSize: 12, color: "rgba(243,236,220,0.6)", marginTop: 3 }}>
                      {s.key === "car" ? "Drive the scent with you." : s.key === "wash" ? "Cleanse with character." : s.key === "moist" ? "Hydrate and layer." : "Four ways to live it."}
                    </span>
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <span style={{ fontFamily: MONO, fontSize: 12 }}>
                        {s.status === "coming_soon" ? <Chip tone="gold" style={{ height: 22 }}>Coming soon</Chip> : (
                          <>
                            {money(s.price)}
                            {s.compareAt && <s style={{ marginLeft: 8, color: "rgba(243,236,220,0.4)" }}>{money(s.compareAt)}</s>}
                          </>
                        )}
                      </span>
                      <span style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid rgba(201,169,97,0.7)", display: "grid", placeItems: "center", color: GOLD }}><Arrow size={10} /></span>
                    </span>
                  </span>
                </button>
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
            <button style={btnLink} onClick={() => navigate(paths.fragrances)}>Explore more fragrances <Arrow size={10} /></button>
          </div>
          <div className="mo-vault-grid" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {related.map((r) => (
              <FragranceCard key={r.id} frag={r} vip={vip} onQuickView={onQuickView} />
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}
