import { useMemo, useState } from "react";
import { type Fragrance, type FormatKey, GOLD, CREAM, money } from "../lib/data";
import { formatPrice, FORMAT_BY_KEY, MOODS, moodsOf, profileOf, referenceOf } from "../lib/formats";
import { type PickMode, SUBSCRIPTION_FORMATS, SUBSCRIPTION_MONTHS, rangeLabel, subscriptionFrom, subscriptionPrice, subscriptionRange } from "../lib/subscription";
import { navigate, paths } from "../lib/route";
import BottleImage from "./BottleImage";
import { FormatGlyph } from "./ProductGlyphs";
import { Arrow, Chip, Container, InspiredBy } from "./ui";
import { MONO, SERIF, btnGold, btnLink, micro } from "./styles";

interface SubscribeProps {
  fragrances: Fragrance[];
  vip: boolean;
  initialSlug?: string | null;
  initialFormat?: string | null;
  /** True once the visitor holds an active subscription (one per account). */
  hasActive: boolean;
  busy: boolean;
  /** Just started: show the confirmation instead of the builder. */
  started: boolean;
  error?: string | null;
  /** `frag` is the customer's month-1 pick; null means the house draws it. */
  onStart: (format: FormatKey, frag: Fragrance | null, mode: PickMode) => void;
}

const STEPS = [
  { n: "01", title: "Choose your format", body: "A 10, 30 or 50 ml Eau de Parfum, or the car diffuser. The same format arrives every month." },
  { n: "02", title: "Choose, or be surprised", body: "Pick each month's scent yourself, or let the house draw one at random — never the same scent twice." },
  { n: "03", title: "Twelve months, billed monthly", body: "Each month you pay 10% under that bottle's shelf price. Cancel any time; paid months still ship." },
];

/**
 * The Monthly Pour: a 12-month subscription to one format, one fragrance a
 * month, 10% under the shelf price. Format first, then the first scent, with
 * a running summary that becomes the order.
 */
export default function Subscribe({ fragrances, vip, initialSlug, initialFormat, hasActive, busy, started, error, onStart }: SubscribeProps) {
  const [format, setFormat] = useState<FormatKey>(
    initialFormat && SUBSCRIPTION_FORMATS.includes(initialFormat as FormatKey) ? (initialFormat as FormatKey) : "perf30",
  );
  const pool = useMemo(() => fragrances.filter((f) => !f.vipOnly || vip), [fragrances, vip]);
  const [slug, setSlug] = useState<string | null>(initialSlug ?? null);
  const [mood, setMood] = useState<string | null>(null);
  const [mode, setMode] = useState<PickMode>("choose");
  const frag = mode === "choose" ? (pool.find((f) => f.slug === slug) ?? null) : null;
  const range = rangeLabel(subscriptionRange(pool, format));
  const ready = mode === "surprise" || !!frag;
  const shown = mood ? pool.filter((f) => moodsOf(f).includes(mood as ReturnType<typeof moodsOf>[number])) : pool;

  const shelf = frag ? formatPrice(frag, format) : null;
  const member = frag ? subscriptionPrice(frag, format) : null;

  if (started) {
    return (
      <main data-screen-label="Subscribed" style={{ minHeight: "60vh" }}>
        <Container style={{ padding: "80px 32px 100px", maxWidth: 760 }}>
          <div style={{ ...micro, color: GOLD }}>The Monthly Pour</div>
          <h1 style={{ margin: "14px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 52, color: CREAM, lineHeight: 1 }}>You're in.</h1>
          <p style={{ margin: "18px 0 0", fontSize: 14.5, lineHeight: 1.7, color: "rgba(243,236,220,0.65)" }}>
            Your first bottle is on its way and your card will be charged on the same day each month for the next {SUBSCRIPTION_MONTHS - 1} months.
            Choose next month's scent, track deliveries or cancel from your account.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 30, flexWrap: "wrap" }}>
            <button className="mo-cta" style={btnGold} onClick={() => navigate(paths.account)}>Manage my subscription <Arrow /></button>
            <button style={{ ...btnLink, fontSize: 10.5 }} onClick={() => navigate(paths.fragrances)}>Browse the house</button>
          </div>
        </Container>
      </main>
    );
  }

  return (
    <main data-screen-label="Subscribe" style={{ minHeight: "60vh" }}>
      <section style={{ borderBottom: "1px solid #1f1f27", background: "linear-gradient(180deg, #0d0d11, #0b0b0d)" }}>
        <Container style={{ padding: "54px 32px 46px" }}>
          <div style={{ ...micro, color: GOLD }}>The Monthly Pour · 12-month subscription</div>
          <h1 style={{ margin: "12px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 52, color: CREAM, lineHeight: 1, maxWidth: 760 }}>
            A new scent every month. Ten percent off, always.
          </h1>
          <p style={{ margin: "16px 0 0", maxWidth: 600, fontSize: 14.5, lineHeight: 1.7, color: "rgba(243,236,220,0.62)" }}>
            Choose the format you wear. Each month we pour the fragrance you picked and send it to your door, at 10% under the shelf price. Twelve
            months, billed monthly, cancel whenever.
          </p>
          <div className="mo-steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 34 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ border: "1px solid #1f1f27", padding: "18px 20px", background: "#101015" }}>
                <div style={{ fontFamily: MONO, fontSize: 10, color: GOLD, letterSpacing: "0.2em" }}>{s.n}</div>
                <div style={{ fontFamily: SERIF, fontSize: 22, color: CREAM, marginTop: 8 }}>{s.title}</div>
                <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.6)" }}>{s.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <Container style={{ padding: "44px 32px 90px" }}>
        {hasActive && (
          <div style={{ border: "1px solid rgba(201,169,97,0.5)", background: "#101015", padding: "16px 20px", marginBottom: 30, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, color: CREAM }}>You already have an active Monthly Pour. Manage next month's scent from your account.</span>
            <button style={btnLink} onClick={() => navigate(paths.account)}>My subscription <Arrow size={10} /></button>
          </div>
        )}

        <div className="mo-subscribe-grid" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 40, alignItems: "start" }}>
          <div>
            {/* Step 1: format */}
            <div style={{ ...micro, color: GOLD }}>01 · Your format</div>
            <div className="mo-subformats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 14 }}>
              {SUBSCRIPTION_FORMATS.map((key) => {
                const def = FORMAT_BY_KEY[key];
                const active = key === format;
                return (
                  <button
                    key={key}
                    onClick={() => setFormat(key)}
                    aria-pressed={active}
                    style={{
                      textAlign: "left",
                      cursor: "pointer",
                      background: "#101015",
                      border: `1px solid ${active ? GOLD : "#1f1f27"}`,
                      padding: "16px 16px 14px",
                      display: "grid",
                      gap: 10,
                      color: CREAM,
                    }}
                  >
                    <div style={{ height: 80, display: "grid", placeItems: "center" }}>
                      <FormatGlyph formatKey={key} liquid={frag?.liquid ?? "#6b4a2a"} height={72} />
                    </div>
                    <div style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.05 }}>{def.name}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10.5, color: GOLD }}>from {money(subscriptionFrom(pool, key))}/month</div>
                  </button>
                );
              })}
            </div>

            {/* Step 2: who picks */}
            <div style={{ ...micro, color: GOLD, marginTop: 40 }}>02 · Who chooses each month</div>
            <div className="mo-submode-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
              {(
                [
                  { key: "choose", title: "I'll choose", body: "Pick this month's scent below, and change next month's from your account whenever you like." },
                  { key: "surprise", title: "Surprise me", body: `The house draws a scent at random each month — never one you've already received. ${range} a month, 10% under shelf.` },
                ] as { key: PickMode; title: string; body: string }[]
              ).map((o) => {
                const active = mode === o.key;
                return (
                  <button
                    key={o.key}
                    onClick={() => setMode(o.key)}
                    aria-pressed={active}
                    style={{ textAlign: "left", cursor: "pointer", background: "#101015", border: `1px solid ${active ? GOLD : "#1f1f27"}`, padding: "16px 18px", color: CREAM, display: "grid", gap: 6 }}
                  >
                    <div style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1.05 }}>{o.title}</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.6)" }}>{o.body}</div>
                  </button>
                );
              })}
            </div>

            {/* Step 3: this month's scent (choose mode) */}
            {mode === "choose" && (
              <>
            <div style={{ ...micro, color: GOLD, marginTop: 40 }}>03 · This month's scent</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <Chip active={!mood} onClick={() => setMood(null)}>All</Chip>
              {MOODS.map((m) => (
                <Chip key={m.id} active={mood === m.id} onClick={() => setMood(mood === m.id ? null : m.id)}>{m.id}</Chip>
              ))}
            </div>
            <div className="mo-subscents-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
              {shown.map((f) => {
                const active = f.slug === slug;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSlug(f.slug)}
                    aria-pressed={active}
                    style={{ textAlign: "left", cursor: "pointer", background: "#101015", border: `1px solid ${active ? GOLD : "#1f1f27"}`, padding: 0, color: CREAM, display: "grid" }}
                  >
                    <BottleImage imageUrl={f.imageUrl} fallbackSrc="/assets/bottle-square.jpg" alt={`${f.name} bottle`} accent={f.accent} liquid={f.liquid} height={150} />
                    <div style={{ padding: "12px 14px 14px", display: "grid", gap: 6 }}>
                      <div style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.05 }}>{f.name}</div>
                      <div style={{ ...micro, fontSize: 8.5, color: "rgba(243,236,220,0.55)" }}>{profileOf(f).join(" · ")}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, color: GOLD }}>{money(subscriptionPrice(f, format))}/mo</span>
                        <span style={{ fontFamily: MONO, fontSize: 9.5, color: "rgba(243,236,220,0.4)", textDecoration: "line-through" }}>{money(formatPrice(f, format))}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
              </>
            )}
          </div>

          {/* Summary */}
          <aside className="mo-subscribe-summary" style={{ position: "sticky", top: 90, border: "1px solid rgba(201,169,97,0.45)", background: "#101015", padding: 24, display: "grid", gap: 16 }}>
            <div style={{ ...micro, color: GOLD }}>Your Monthly Pour</div>
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 26, color: CREAM, lineHeight: 1.05 }}>{FORMAT_BY_KEY[format].name}</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: "rgba(243,236,220,0.55)", marginTop: 6 }}>Every month for {SUBSCRIPTION_MONTHS} months</div>
            </div>
            <div style={{ borderTop: "1px solid #1f1f27", paddingTop: 16 }}>
              {mode === "surprise" ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ ...micro, fontSize: 8.5 }}>Every month</div>
                  <div style={{ fontFamily: SERIF, fontSize: 21, color: CREAM, lineHeight: 1.05 }}>The house chooses.</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.6)" }}>A random scent from the collection, never repeated. Revealed when it ships.</div>
                </div>
              ) : frag ? (
                <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 14, alignItems: "center" }}>
                  <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-square.jpg" alt="" accent={frag.accent} liquid={frag.liquid} height={88} />
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ ...micro, fontSize: 8.5 }}>Month 1</div>
                    <div style={{ fontFamily: SERIF, fontSize: 21, color: CREAM, lineHeight: 1.05 }}>{frag.name}</div>
                    <InspiredBy {...referenceOf(frag)} size="sm" />
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "rgba(243,236,220,0.55)", lineHeight: 1.6 }}>Pick this month's scent below to see your price, or let the house choose.</div>
              )}
            </div>
            <div style={{ borderTop: "1px solid #1f1f27", paddingTop: 16, display: "grid", gap: 8, fontFamily: MONO, fontSize: 11.5 }}>
              {mode === "surprise" ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(243,236,220,0.55)" }}>
                    <span>Member discount</span>
                    <span style={{ color: GOLD }}>−10%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: CREAM, fontSize: 15, marginTop: 4 }}>
                    <span>Each month</span>
                    <span>{range}</span>
                  </div>
                  <div style={{ fontSize: 10.5, lineHeight: 1.6, color: "rgba(243,236,220,0.45)", fontFamily: "inherit" }}>
                    10% under the shelf price of whichever bottle the house draws. Month 1 is drawn and charged today.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(243,236,220,0.55)" }}>
                    <span>Shelf price</span>
                    <span style={{ textDecoration: "line-through" }}>{shelf !== null ? money(shelf) : "—"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(243,236,220,0.55)" }}>
                    <span>Member discount</span>
                    <span style={{ color: GOLD }}>−10%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: CREAM, fontSize: 15, marginTop: 4 }}>
                    <span>This month</span>
                    <span>{member !== null ? money(member) : "—"}</span>
                  </div>
                  <div style={{ fontSize: 10.5, lineHeight: 1.6, color: "rgba(243,236,220,0.45)", fontFamily: "inherit" }}>
                    Then monthly at 10% under the shelf price of each month's pick. Your card is charged today for month 1.
                  </div>
                </>
              )}
            </div>
            {error && <div style={{ fontSize: 11.5, color: "#d98a6a", lineHeight: 1.5 }}>{error}</div>}
            <button
              className="mo-cta"
              disabled={!ready || busy || hasActive}
              onClick={() => ready && onStart(format, frag, mode)}
              style={{ ...btnGold, width: "100%", justifyContent: "center", height: 50, opacity: !ready || busy || hasActive ? 0.55 : 1, cursor: !ready || busy || hasActive ? "default" : "pointer" }}
            >
              {busy ? "Starting…" : "Start my subscription"} <Arrow />
            </button>
            <div style={{ fontSize: 10.5, lineHeight: 1.6, color: "rgba(243,236,220,0.45)", textAlign: "center" }}>
              Cancel any time from your account. Months already paid still ship.
            </div>
          </aside>
        </div>
      </Container>
    </main>
  );
}
