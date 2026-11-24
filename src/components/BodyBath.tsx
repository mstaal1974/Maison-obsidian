import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { type Fragrance, type FormatKey, GOLD, CREAM, matches, money } from "../lib/data";
import { GIFT_BOX_PRICE, matchesReference, referenceOf, sku as skuOf, formatStatus } from "../lib/formats";
import type { GiftCard } from "../lib/bag";
import { joinWaitlist } from "../lib/waitlist";
import { trackViewItemList } from "../lib/analytics";
import BottleImage from "./BottleImage";
import { Container, InspiredBy } from "./ui";
import { MONO, SERIF, body, btnGold, micro } from "./styles";

type Wearer = "him" | "her";
type Step = 1 | 2 | 3;

/** What can be bought on this page: the boxed set first, then the two singles. */
const PRODUCTS: { key: FormatKey; title: string; sub: string }[] = [
  { key: "ritual", title: "Gift Box", sub: "30 ml eau de parfum, body wash and body lotion, boxed" },
  { key: "wash", title: "Body Wash", sub: "300 ml" },
  { key: "moist", title: "Body Lotion", sub: "300 ml" },
];

const LIMIT = { to: 40, from: 40, note: 240 } as const;

interface BodyBathProps {
  fragrances: Fragrance[];
  vip: boolean;
  onAdd: (frag: Fragrance, format: FormatKey, gift: GiftCard | null) => void;
}

/**
 * Body & Bath as a short guided choice, not a grid to sift: who it's for,
 * which scent (picked by the fragrance they already know — the "Inspired by"
 * leads each tile), then what to buy and whether it's a gift. A gift carries a
 * card — To, From and a note — that is written by hand and packed with it.
 */
export default function BodyBath({ fragrances, vip, onAdd }: BodyBathProps) {
  const [step, setStep] = useState<Step>(1);
  const [wearer, setWearer] = useState<Wearer | null>(null);
  const [frag, setFrag] = useState<Fragrance | null>(null);
  const [product, setProduct] = useState<FormatKey>("ritual");
  const [gift, setGift] = useState<boolean | null>(null);
  const [card, setCard] = useState<GiftCard>({ to: "", from: "", note: "" });
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState(false);
  const stepTop = useRef<HTMLDivElement>(null);

  // Scents with body care on sale or coming: masculine or feminine, plus unisex.
  const shelf = useMemo(() => {
    const has = (f: Fragrance) => PRODUCTS.some((p) => formatStatus(f, p.key) !== "hidden") && (!f.vipOnly || vip);
    const base = fragrances.filter(has);
    return wearer ? base.filter((f) => matches(f, wearer === "him" ? "men" : "women")) : base;
  }, [fragrances, wearer, vip]);
  const shown = useMemo(() => shelf.filter((f) => matchesReference(f, query)), [shelf, query]);

  const listKey = wearer ? shelf.map((f) => f.id).join(",") : "";
  useEffect(() => {
    if (!listKey) return;
    trackViewItemList(`body_${wearer}`, shelf.map((f) => ({ id: f.id, name: f.name })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  const go = (s: Step) => {
    setStep(s);
    setAdded(false);
    window.requestAnimationFrame(() => stepTop.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const s = frag ? skuOf(frag, product) : null;
  const giftReady = gift === false || (gift === true && (card.to.trim() || card.from.trim() || card.note.trim()));
  const add = () => {
    if (!frag || !s?.buyable || !giftReady) return;
    const g = gift ? { to: card.to.trim(), from: card.from.trim(), note: card.note.trim() } : null;
    onAdd(frag, product, g);
    setAdded(true);
  };
  const reset = () => {
    setFrag(null);
    setGift(null);
    setCard({ to: "", from: "", note: "" });
    setProduct("ritual");
    go(2);
  };

  return (
    <div className="mo-bodybath">
      <section aria-label="Body & Bath" style={{ borderBottom: "1px solid #1f1f27", background: "#0d0d10" }}>
        <Container className="mo-bb-hero" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)", gap: 40, alignItems: "center", paddingTop: 40, paddingBottom: 40 }}>
          <div style={{ maxWidth: 560 }}>
            <p style={{ ...micro, color: GOLD, margin: 0 }}>Body &amp; Bath</p>
            <h1 style={{ margin: "12px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(38px, 5vw, 60px)", lineHeight: 1.02, color: CREAM }}>Your scent, from shower to skin.</h1>
            <p style={{ ...body, margin: "14px 0 0", fontSize: 15, color: "rgba(243,236,220,0.8)" }}>
              Body wash and body lotion in your fragrance — or all three in the Gift Box, {money(GIFT_BOX_PRICE)}. Three quick steps.
            </p>
          </div>
          <img
            src="/assets/gift-box.jpg"
            alt="Maison Obsidian Gift Box: 30 ml eau de parfum, body wash and body lotion"
            width={420}
            height={420}
            style={{ width: "100%", height: "auto", aspectRatio: "1 / 1", objectFit: "cover", display: "block", border: "1px solid #1f1f27" }}
          />
        </Container>
      </section>

      <Container style={{ paddingTop: 34, paddingBottom: 90 }}>
        <div ref={stepTop} style={{ scrollMarginTop: 90 }} />
        <Steps step={step} wearer={wearer} frag={frag} onGo={(n) => (n === 1 || (n === 2 && wearer) || (n === 3 && frag)) && go(n)} />

        {/* ─── 1 · Who it's for ─────────────────────────────────────────── */}
        {step === 1 && (
          <section aria-labelledby="bb-1" style={{ marginTop: 30 }}>
            <h2 id="bb-1" style={heading}>Who is it for?</h2>
            <p style={{ ...body, margin: "8px 0 0" }}>Unisex scents are in both.</p>
            <div className="mo-bb-two" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginTop: 22, maxWidth: 640 }}>
              {(["him", "her"] as Wearer[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={wearer === w}
                  onClick={() => {
                    setWearer(w);
                    setFrag(null);
                    setQuery("");
                    go(2);
                  }}
                  style={{ ...choice(wearer === w), minHeight: 108, padding: "20px 22px", textAlign: "left" }}
                >
                  <span style={{ display: "block", fontFamily: SERIF, fontSize: 30, color: CREAM, lineHeight: 1 }}>{w === "him" ? "For him" : "For her"}</span>
                  <span style={{ display: "block", ...micro, marginTop: 10, color: "rgba(243,236,220,0.6)" }}>{w === "him" ? "Masculine + unisex" : "Feminine + unisex"}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ─── 2 · Which scent ──────────────────────────────────────────── */}
        {step === 2 && wearer && (
          <section aria-labelledby="bb-2" style={{ marginTop: 30 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <h2 id="bb-2" style={heading}>Choose the scent</h2>
                <p style={{ ...body, margin: "8px 0 0" }}>Pick by the fragrance you already know.</p>
              </div>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search “Inspired by”…"
                aria-label="Search by the fragrance it's inspired by"
                style={{ width: 280, maxWidth: "100%", height: 42, background: "#101015", border: "1px solid #2a2a33", color: CREAM, padding: "0 14px", fontSize: 14, outline: "none" }}
              />
            </div>
            <ul className="mo-bb-tiles" style={{ listStyle: "none", padding: 0, margin: "22px 0 0", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {shown.map((f) => {
                const ref = referenceOf(f);
                const on = frag?.id === f.id;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`${f.name}, inspired by ${ref.brand}${ref.fragrance ? ` ${ref.fragrance}` : ""}`}
                      onClick={() => {
                        setFrag(f);
                        go(3);
                      }}
                      style={{ ...choice(on), width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 8, padding: 10, textAlign: "left" }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ width: 46, flexShrink: 0 }}>
                          <BottleImage imageUrl={f.imageUrl} fallbackSrc="/assets/bottle-portrait.webp" alt="" accent={f.accent} liquid={f.liquid} height={56} />
                        </div>
                        <span style={{ minWidth: 0, overflowWrap: "break-word", hyphens: "auto", fontFamily: SERIF, fontSize: 18, lineHeight: 1.1, color: CREAM }}>{f.name}</span>
                      </div>
                      <InspiredBy {...ref} size="sm" style={{ padding: "6px 9px 7px 8px" }} />
                    </button>
                  </li>
                );
              })}
            </ul>
            {!shown.length && <p style={{ ...body, marginTop: 20 }}>No scent matches “{query}”. Try the house name, like Tom Ford or Dior.</p>}
          </section>
        )}

        {/* ─── 3 · What, and is it a gift ───────────────────────────────── */}
        {step === 3 && frag && (
          <section aria-labelledby="bb-3" style={{ marginTop: 30 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: 56 }}>
                <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-portrait.webp" alt="" accent={frag.accent} liquid={frag.liquid} height={64} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: SERIF, fontSize: 24, color: CREAM, textTransform: "uppercase", letterSpacing: "0.04em" }}>{frag.name}</div>
                <InspiredBy {...referenceOf(frag)} size="sm" style={{ marginTop: 6, width: "auto" }} />
              </div>
              <button type="button" onClick={() => go(2)} style={linkBtn}>Change scent</button>
            </div>

            <h2 id="bb-3" style={{ ...heading, marginTop: 30 }}>Choose</h2>
            <div role="radiogroup" aria-label="Product" className="mo-bb-products" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 16 }}>
              {PRODUCTS.map((p) => {
                const ps = skuOf(frag, p.key);
                if (ps.status === "hidden") return null;
                const on = product === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setProduct(p.key);
                      setAdded(false);
                    }}
                    style={{ ...choice(on), padding: 0, textAlign: "left", overflow: "hidden", display: "flex", flexDirection: "column" }}
                  >
                    {p.key === "ritual" && <img src="/assets/gift-box.jpg" alt="" loading="lazy" style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} />}
                    <span style={{ padding: "14px 16px 16px", display: "block" }}>
                      <span style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                        <span style={{ fontFamily: SERIF, fontSize: 24, color: CREAM }}>{p.title}</span>
                        <span style={{ fontFamily: MONO, fontSize: 13, color: GOLD }}>{money(ps.price)}</span>
                      </span>
                      <span style={{ display: "block", fontSize: 13, color: "rgba(243,236,220,0.6)", marginTop: 4, lineHeight: 1.5 }}>{p.sub}</span>
                      {p.key === "ritual" && ps.compareAt && ps.compareAt > ps.price && (
                        <span style={{ display: "block", ...micro, color: GOLD, marginTop: 8 }}>Save {money(ps.compareAt - ps.price)} on the three</span>
                      )}
                      {!ps.buyable && <span style={{ display: "block", ...micro, color: "rgba(243,236,220,0.5)", marginTop: 8 }}>{ps.status === "coming_soon" ? "Coming soon" : ps.availability}</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {s && !s.buyable ? (
              <NotifyMe frag={frag} format={product} title={PRODUCTS.find((p) => p.key === product)?.title ?? ""} />
            ) : (
              <>
                <h2 style={{ ...heading, marginTop: 34 }}>Is it a gift?</h2>
                <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      aria-pressed={gift === v}
                      onClick={() => {
                        setGift(v);
                        setAdded(false);
                      }}
                      style={{ ...choice(gift === v), minWidth: 150, height: 52, fontSize: 16, color: CREAM }}
                    >
                      {v ? "Yes, add a card" : "No, it's for me"}
                    </button>
                  ))}
                </div>

                {gift && (
                  <div style={{ marginTop: 20, maxWidth: 560, display: "grid", gap: 12 }}>
                    <p style={{ ...body, margin: 0 }}>We'll hand-write your card and pack it in the box. Prices aren't included in the parcel.</p>
                    <div className="mo-bb-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="To" value={card.to} max={LIMIT.to} onChange={(to) => setCard({ ...card, to })} placeholder="Their name" />
                      <Field label="From" value={card.from} max={LIMIT.from} onChange={(from) => setCard({ ...card, from })} placeholder="Your name" />
                    </div>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ ...micro, color: "rgba(243,236,220,0.7)" }}>Note</span>
                      <textarea
                        value={card.note}
                        maxLength={LIMIT.note}
                        rows={4}
                        onChange={(e) => setCard({ ...card, note: e.target.value })}
                        placeholder="Happy birthday — smell amazing."
                        style={{ ...input, height: "auto", padding: "12px 14px", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                      />
                      <span style={{ ...micro, fontSize: 8.5, color: "rgba(243,236,220,0.45)", textAlign: "right" }}>{card.note.length}/{LIMIT.note}</span>
                    </label>
                  </div>
                )}

                {gift !== null && s && (
                  <div style={{ marginTop: 26, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <button type="button" onClick={add} disabled={!giftReady} style={{ ...btnGold, height: 54, padding: "0 28px", opacity: giftReady ? 1 : 0.5, cursor: giftReady ? "pointer" : "not-allowed" }}>
                      Add to bag · {money(s.price)}
                    </button>
                    {gift && !giftReady && <span style={{ ...micro, color: "rgba(243,236,220,0.55)" }}>Fill in the card to continue</span>}
                    {added && (
                      <span role="status" style={{ fontSize: 14, color: GOLD }}>
                        Added.{" "}
                        <button type="button" onClick={reset} style={linkBtn}>Choose another</button>
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </Container>
    </div>
  );
}

function Steps({ step, wearer, frag, onGo }: { step: Step; wearer: Wearer | null; frag: Fragrance | null; onGo: (s: Step) => void }) {
  const items: { n: Step; label: string; value: string | null }[] = [
    { n: 1, label: "For", value: wearer ? (wearer === "him" ? "Him" : "Her") : null },
    { n: 2, label: "Scent", value: frag?.name ?? null },
    { n: 3, label: "Choose & gift", value: null },
  ];
  return (
    <ol aria-label="Steps" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
      {items.map((it) => {
        const current = it.n === step;
        return (
          <li key={it.n}>
            <button
              type="button"
              aria-current={current ? "step" : undefined}
              onClick={() => onGo(it.n)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 36,
                padding: "0 14px 0 6px",
                background: current ? "rgba(201,169,97,0.14)" : "transparent",
                border: `1px solid ${current ? GOLD : "#2a2a33"}`,
                color: current ? CREAM : "rgba(243,236,220,0.65)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <span style={{ display: "inline-grid", placeItems: "center", width: 24, height: 24, borderRadius: "50%", background: current || it.value ? GOLD : "#2a2a33", color: "#0b0b0d", fontSize: 12, fontWeight: 700 }}>
                {it.value && !current ? "✓" : it.n}
              </span>
              {it.label}
              {it.value ? <span style={{ color: GOLD }}>· {it.value}</span> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, value, max, onChange, placeholder }: { label: string; value: string; max: number; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ ...micro, color: "rgba(243,236,220,0.7)" }}>{label}</span>
      <input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={input} />
    </label>
  );
}

/** Not on sale yet: one email when it is. */
function NotifyMe({ frag, format, title }: { frag: Fragrance; format: FormatKey; title: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  if (state === "done") return <p style={{ ...body, marginTop: 26, color: GOLD }}>We'll email you once when {frag.name} {title} is here.</p>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        setState((await joinWaitlist(frag.id, format, email)) ? "done" : "error");
      }}
      style={{ marginTop: 26, maxWidth: 520 }}
    >
      <p style={{ ...body, margin: 0 }}>{frag.name} {title} is coming soon. Leave your email and we'll tell you when it arrives.</p>
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" aria-label="Your email" style={{ ...input, flex: 1, minWidth: 200 }} />
        <button type="submit" disabled={state === "busy"} style={{ ...btnGold, height: 46 }}>
          {state === "busy" ? "Saving…" : "Notify me"}
        </button>
      </div>
      {state === "error" && <p style={{ ...micro, color: "#E08A6A", marginTop: 10 }}>That didn't save — check the email and try again.</p>}
    </form>
  );
}

const heading: CSSProperties = { margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px, 3.4vw, 40px)", color: CREAM, lineHeight: 1.05 };
const input: CSSProperties = { height: 46, background: "#101015", border: "1px solid #2a2a33", color: CREAM, padding: "0 14px", fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box" };
const linkBtn: CSSProperties = { background: "none", border: 0, color: GOLD, cursor: "pointer", padding: "6px 2px", fontSize: 14, textDecoration: "underline", textUnderlineOffset: 4 };
function choice(on: boolean): CSSProperties {
  return {
    background: on ? "rgba(201,169,97,0.12)" : "#101015",
    border: `1px solid ${on ? GOLD : "#24242c"}`,
    boxShadow: on ? `inset 0 0 0 1px ${GOLD}` : "none",
    cursor: "pointer",
    color: CREAM,
  };
}
