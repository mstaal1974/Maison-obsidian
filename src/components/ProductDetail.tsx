import { useMemo, useState } from "react";
import { bottleImage } from "../lib/images";
import { type Fragrance, type FormatKey, GOLD, CREAM, money } from "../lib/data";
import { GROUPS, type FormatGroup, skusInGroup, sku as skuOf, profileOf, referenceOf, experienceOf, relatedTo, type Sku } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import BottleImage from "./BottleImage";
import FragranceCard from "./FragranceCard";
import { bottleBackdrop } from "./adminStyles";
import { FormatGlyph } from "./ProductGlyphs";
import { Arrow, Container, Icon, IconBadge, SideCaption, Chip, InspiredBy } from "./ui";
import { MONO, SERIF, btnGold, btnLink, micro } from "./styles";

interface ProductDetailProps {
  frag: Fragrance;
  fragrances: Fragrance[];
  vip: boolean;
  effectiveCommitted: number;
  onAdd: (f: Fragrance, key: FormatKey, qty: number, engraving: string | null) => void;
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
}

const ORDER: FormatGroup[] = ["wear", "drive", "live", "ritual"];
const ENGRAVE_MAX = 28;

/**
 * The fragrance's world. One page per scent; the customer chooses how to
 * experience it — Wear it / Drive with it / Live in it / Complete the ritual —
 * and reads the notes and the story underneath.
 */
export default function ProductDetail({ frag, fragrances, vip, effectiveCommitted, onAdd, onQuickView }: ProductDetailProps) {
  const [key, setKey] = useState<FormatKey>("perf50");
  const [qty, setQty] = useState(1);
  const [engraveOn, setEngraveOn] = useState(false);
  const [engraving, setEngraving] = useState("");
  const [notified, setNotified] = useState<Set<FormatKey>>(new Set());
  const [shot, setShot] = useState(0);
  const chosen = skuOf(frag, key);
  const locked = !!frag.vipOnly && !vip;
  const profile = profileOf(frag);
  const related = useMemo(() => relatedTo(frag, fragrances, 4), [frag, fragrances]);

  const gallery = [
    { kind: "bottle" as const, label: "Bottle" },
    { kind: "img" as const, src: "/assets/30%20ml%20bottle.jpeg", label: "Eau de Parfum" },
    { kind: "img" as const, src: "/assets/car-freshner.jpg", label: "Car diffuser" },
    { kind: "img" as const, src: "/assets/body%20and%20sets.jpg", label: "Ritual set" },
  ];

  const canEngrave = chosen.def.group === "wear";
  const finalEngraving = canEngrave && engraveOn ? engraving.trim().slice(0, ENGRAVE_MAX) || null : null;

  const option = (s: Sku) => {
    const active = s.key === key;
    const soon = s.status === "coming_soon";
    const wide = s.key === "ritual";
    return (
      <button
        key={s.key}
        onClick={() => (soon ? setNotified((n) => new Set(n).add(s.key)) : setKey(s.key))}
        aria-pressed={active}
        title={s.availability}
        style={{
          background: "none",
          border: `1px solid ${active ? GOLD : "transparent"}`,
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
          {soon ? (notified.has(s.key) ? "Notified ✓" : "Notify me") : (
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
      {/* ── Top: gallery + details ── */}
      <div className="mo-pdp-grid" style={{ display: "grid", gridTemplateColumns: "0.72fr 1.28fr", borderBottom: "1px solid #1f1f27" }}>
        {/* GALLERY */}
        <div style={{ borderRight: "1px solid #1f1f27", padding: "18px 24px 22px 32px" }}>
          <div style={{ position: "relative", background: bottleBackdrop(frag.accent, frag.liquid), border: "1px solid #1f1f27", minHeight: 420 }}>
            {gallery[shot].kind === "bottle" ? (
              <BottleImage imageUrl={bottleImage(frag)} fallbackSrc="/assets/bottle-pdp.jpg" alt={`${frag.name} bottle`} accent={frag.accent} liquid={frag.liquid} height={440} objectPosition="center 40%" />
            ) : (
              <img src={gallery[shot].src} alt={`${frag.name} — ${gallery[shot].label}`} style={{ display: "block", width: "100%", height: 440, objectFit: "cover" }} />
            )}
            <SideCaption lines={[...profile, "—", "A bolder", "you"]} style={{ position: "absolute", left: 18, top: 20, background: "rgba(11,11,13,0.55)", padding: "10px 12px", backdropFilter: "blur(2px)" }} />
          </div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            {gallery.map((g, i) => (
              <button key={g.label} onClick={() => setShot(i)} aria-label={g.label} aria-pressed={shot === i} style={{ padding: 0, border: `1px solid ${shot === i ? GOLD : "#1f1f27"}`, background: "#0e0e12", cursor: "pointer", height: 96, overflow: "hidden" }}>
                {g.kind === "bottle" ? (
                  <BottleImage imageUrl={bottleImage(frag)} fallbackSrc="/assets/bottle-square.jpg" alt="" accent={frag.accent} liquid={frag.liquid} height={94} />
                ) : (
                  <img src={g.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </button>
            ))}
            <button aria-label="Play video" style={{ border: "1px solid #1f1f27", background: "#0e0e12", color: GOLD, cursor: "pointer", height: 96, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(201,169,97,0.7)", display: "grid", placeItems: "center" }}><Icon name="play" size={14} /></span>
              <span style={{ ...micro, fontSize: 7.5, color: CREAM }}>Play video</span>
            </button>
          </div>
        </div>

        {/* DETAILS */}
        <div style={{ padding: "18px 32px 26px 30px", display: "grid", gridTemplateColumns: "1fr auto", gap: 18 }}>
          <div style={{ minWidth: 0 }}>
            <nav aria-label="Breadcrumb" style={{ ...micro, fontSize: 8.5, display: "flex", gap: 6 }}>
              <button style={{ ...btnLink, color: "rgba(243,236,220,0.5)", fontSize: 8.5 }} onClick={() => navigate(paths.home)}>Home</button> /
              <button style={{ ...btnLink, color: "rgba(243,236,220,0.5)", fontSize: 8.5 }} onClick={() => navigate(paths.fragrances)}>Fragrances</button> /
              <span style={{ color: "rgba(243,236,220,0.8)" }}>{frag.name}</span>
            </nav>
            <h1 style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 54, lineHeight: 1, color: CREAM }}>{frag.name}</h1>
            <div style={{ ...micro, color: GOLD, marginTop: 10, letterSpacing: "0.34em" }}>{profile.join(" · ")}</div>
            <div style={{ marginTop: 14 }}><InspiredBy {...referenceOf(frag)} size="lg" /></div>
            <p style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.45, color: "rgba(243,236,220,0.78)", maxWidth: 620 }}>{frag.story}</p>

            <div style={{ display: "flex", gap: 34, marginTop: 20, flexWrap: "wrap" }}>
              {experienceOf(frag).map((e) => (
                <IconBadge key={e.label} name={e.icon} label={e.label} />
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 26 }}>
              <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 24, color: CREAM }}>Choose your format</h2>
              <button style={btnLink} onClick={() => navigate(paths.about)}>Size guide <Arrow size={10} /></button>
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

            {/* Summary + add */}
            <div style={{ marginTop: 18, borderTop: "1px solid #1f1f27", paddingTop: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 220 }}>
                <span style={{ width: 62, height: 78, flexShrink: 0, display: "grid", placeItems: "center", background: bottleBackdrop(frag.accent, frag.liquid), border: "1px solid #1f1f27" }}>
                  {bottleImage(frag) ? <BottleImage imageUrl={bottleImage(frag)} fallbackSrc="/assets/bottle-square.jpg" alt="" accent={frag.accent} liquid={frag.liquid} height={76} /> : <FormatGlyph formatKey={key} liquid={frag.liquid} height={64} />}
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
                onClick={() => onAdd(frag, key, qty, finalEngraving)}
              >
                <Icon name="bag" size={14} color="#0b0b0d" /> {locked ? "VIP members only" : chosen.buyable ? "Add to bag" : chosen.status === "coming_soon" ? "Coming soon" : "Sold out"}
              </button>
              <button aria-label="Save to wishlist" style={{ width: 52, height: 52, border: "1px solid rgba(201,169,97,0.5)", background: "none", cursor: "pointer", display: "grid", placeItems: "center" }}>
                <Icon name="heart" size={16} />
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 10, flexWrap: "wrap", ...micro, fontSize: 8.5 }}>
              <span style={{ color: chosen.status === "live" && (chosen.stock > 0 || chosen.def.group === "wear") ? "#8bb98a" : GOLD }}>
                ● {chosen.availability}
                {chosen.def.group === "wear" && chosen.stock === 0 && chosen.status === "live" ? ` · ${effectiveCommitted}/${frag.moq} committed` : ""}
              </span>
              <span style={{ display: "flex", gap: 18 }}>
                <span><Icon name="truck" size={12} color="rgba(243,236,220,0.6)" /> Free shipping over $100</span>
                <span><Icon name="refresh" size={12} color="rgba(243,236,220,0.6)" /> 30-day returns</span>
              </span>
            </div>

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
                  onClick={() => { setKey(s.key); window.scrollTo({ top: 0, behavior: "smooth" }); }}
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
