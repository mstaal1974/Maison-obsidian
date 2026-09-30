import { type FormEvent, useMemo, useState } from "react";
import { type Fragrance, type FormatKey, GOLD, CREAM, money } from "../lib/data";
import { DISCOVERY_BOX_PRICE, DISCOVERY_BOX_SIZE, fromPrice, profileOf } from "../lib/formats";
import { FREE_SHIPPING_THRESHOLD_CENTS } from "../lib/shipping";
import { navigate, paths } from "../lib/route";
import { trackSelectItem } from "../lib/analytics";
import { isNew } from "../lib/launch";
import BottleImage from "./BottleImage";
import ChooseObsidian from "./ChooseObsidian";
import { Art, Arrow, Container, Icon, type IconName } from "./ui";
import { MONO, SERIF, btnGold, btnLink, h2, micro } from "./styles";

interface SimpleHomeProps {
  fragrances: Fragrance[];
  vip: boolean;
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
}

/**
 * The simplified homepage (UX simplification plan). Five blocks, one
 * decision at a time: a focused hero, a choice of how to find a scent, four
 * scents to start with, the formats as ways into the day, and reassurance.
 * Everything the full homepage offers stays reachable from the header.
 */
export default function SimpleHome({ fragrances, vip, onQuickView }: SimpleHomeProps) {
  return (
    <main data-screen-label="Home (simplified)">
      <FocusedHero />
      <GuidedChoice />
      <StartHere fragrances={fragrances} vip={vip} onQuickView={onQuickView} />
      <ChooseObsidian title="Make it part of your day" sub="The same scents, for the car and the shower too." />
      <Reassurance />
    </main>
  );
}

const shipping = money(FREE_SHIPPING_THRESHOLD_CENTS);

/** Block 1 — one promise, one primary action, one quiet way to get help. */
function FocusedHero() {
  return (
    <section aria-label="Hero" style={{ borderBottom: "1px solid #1f1f27" }}>
      <Art
        src="/assets/hero-lineup.jpg"
        fallback="/assets/bottle-pair.png"
        alt="Maison Obsidian eau de parfum, discovery bottle, car diffuser and body care"
        position="right center"
        priority
        style={{ minHeight: 480 }}
        overlay="linear-gradient(90deg, rgba(11,11,13,0.96) 0%, rgba(11,11,13,0.82) 32%, rgba(11,11,13,0.25) 60%, rgba(11,11,13,0.15) 100%), linear-gradient(0deg, rgba(11,11,13,0.7) 0%, transparent 30%)"
      >
        <div style={{ position: "relative", maxWidth: 1400, margin: "0 auto", padding: "64px 32px 56px", minHeight: 480, display: "flex", alignItems: "flex-end" }}>
          <div className="mo-rise" style={{ maxWidth: 560 }}>
            <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(44px, 5.4vw, 76px)", lineHeight: 1.02, color: CREAM, letterSpacing: "-0.01em" }}>
              Wear it. Live it.
              <br />
              Take it with you.
            </h1>
            <p style={{ margin: "24px 0 0", fontFamily: SERIF, fontSize: 21, color: "rgba(243,236,220,0.9)", lineHeight: 1.35 }}>
              Maison Obsidian fragrances, poured across perfume, car and body.
            </p>
            <div style={{ display: "flex", gap: 26, marginTop: 32, alignItems: "center", flexWrap: "wrap" }}>
              <a className="mo-cta" style={{ ...btnGold, textDecoration: "none" }} href={paths.shop()}>
                Shop fragrances <Arrow />
              </a>
              <a href="#find-your-way" style={{ ...btnLink, textDecoration: "none", color: CREAM }}>
                Help me find my scent
              </a>
            </div>
            <p style={{ margin: "22px 0 0", ...micro, color: "rgba(243,236,220,0.6)" }}>
              Free shipping over {shipping} · 10 ml samples of every scent · 30-day returns
            </p>
          </div>
        </div>
      </Art>
    </section>
  );
}

/** Block 2 — pick how to decide, once. The full matcher lives on /find. */
function GuidedChoice() {
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(paths.find(q.trim() || undefined));
  };
  const card = { border: "1px solid #1f1f27", background: "#101015", padding: "26px 24px", display: "flex", flexDirection: "column" as const, gap: 12 };
  const title = { margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 26, color: CREAM, lineHeight: 1.1 };
  const copy = { margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "rgba(243,236,220,0.65)" };
  return (
    <section id="find-your-way" aria-label="Find your scent" style={{ padding: "40px 0", borderBottom: "1px solid #1f1f27", scrollMarginTop: 80 }}>
      <Container>
        <h2 style={h2}>How would you like to choose?</h2>
        <div className="mo-guided-grid" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
          <div style={card}>
            <span style={micro}>01 · I know what I love</span>
            <h3 style={title}>Name a fragrance you love</h3>
            <p style={copy}>We'll match it to the closest scent in the house.</p>
            <form onSubmit={submit} role="search" style={{ marginTop: "auto", display: "flex", border: "1px solid #2a2a33" }}>
              <label htmlFor="mo-simple-match" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                A fragrance you love
              </label>
              <input
                id="mo-simple-match"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. Sauvage, Baccarat Rouge"
                style={{ flex: 1, minWidth: 0, background: "#0e0e12", border: 0, color: CREAM, padding: "12px 12px", fontSize: 14, fontFamily: "inherit" }}
              />
              <button type="submit" aria-label="Find my match" style={{ background: GOLD, border: 0, cursor: "pointer", padding: "0 14px", color: "#0b0b0d", display: "grid", placeItems: "center" }}>
                <Arrow />
              </button>
            </form>
          </div>
          <a href={paths.discover} className="mo-guided-card" style={{ ...card, textDecoration: "none" }}>
            <span style={micro}>02 · Guide me</span>
            <h3 style={title}>Discover my scent profile</h3>
            <p style={copy}>A few quick questions, then your Scent DNA and the scents that suit it.</p>
            <span style={{ ...btnLink, marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
              Start Scent DNA <Arrow size={10} />
            </span>
          </a>
          <a href={paths.discovery} className="mo-guided-card" style={{ ...card, textDecoration: "none" }}>
            <span style={micro}>03 · Let me explore</span>
            <h3 style={title}>Try {DISCOVERY_BOX_SIZE} scents first</h3>
            <p style={copy}>
              Choose {DISCOVERY_BOX_SIZE} discovery bottles for {money(DISCOVERY_BOX_PRICE)}, then pick your full size.
            </p>
            <span style={{ ...btnLink, marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
              Build a Discovery Box <Arrow size={10} />
            </span>
          </a>
        </div>
      </Container>
    </section>
  );
}

/**
 * Block 3 — four scents to start with. Ordered by batch reservations when the
 * live catalogue has them, else the house order. Each card carries one badge
 * at most and one action.
 */
function StartHere({ fragrances, vip, onQuickView }: SimpleHomeProps) {
  const picks = useMemo(
    () =>
      fragrances
        .filter((f) => !f.vipOnly || vip)
        .map((f, i) => ({ f, i }))
        .sort((a, b) => b.f.committed - a.f.committed || a.i - b.i)
        .slice(0, 4)
        .map((x) => x.f),
    [fragrances, vip],
  );
  if (!picks.length) return null;
  return (
    <section aria-label="Start here" style={{ padding: "40px 0", borderBottom: "1px solid #1f1f27" }}>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 20, flexWrap: "wrap" }}>
          <h2 style={h2}>Where to start</h2>
          <a href={paths.shop()} style={{ ...btnLink, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
            Shop all fragrances <Arrow size={10} />
          </a>
        </div>
        <div className="mo-start-grid" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
          {picks.map((f) => (
            <SimpleCard key={f.id} frag={f} onQuickView={onQuickView} />
          ))}
        </div>
      </Container>
    </section>
  );
}

function SimpleCard({ frag, onQuickView }: { frag: Fragrance; onQuickView: SimpleHomeProps["onQuickView"] }) {
  const href = paths.product(frag.slug);
  const select = () => trackSelectItem({ id: frag.id, name: frag.name }, "simple_home_start_here");
  return (
    <article className="mo-card" style={{ border: "1px solid #1f1f27", background: "#101015", display: "flex", flexDirection: "column" }}>
      <a className="mo-card-photo" href={href} onClick={select} tabIndex={-1} aria-hidden="true" style={{ position: "relative", display: "block" }}>
        <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-portrait.webp" alt={`${frag.name} bottle`} accent={frag.accent} liquid={frag.liquid} height={280} />
        {isNew(frag) && <span style={{ position: "absolute", top: 12, right: 12, ...micro, color: "#0b0b0d", background: GOLD, padding: "4px 8px", fontWeight: 600 }}>New</span>}
      </a>
      <div className="mo-card-body" style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <a className="mo-card-name" href={href} onClick={select} style={{ textDecoration: "none", fontFamily: SERIF, fontSize: 22, letterSpacing: "0.06em", textTransform: "uppercase", color: CREAM, lineHeight: 1.05 }}>
          {frag.name}
        </a>
        <div style={{ ...micro, color: "rgba(243,236,220,0.75)", fontSize: 8.5 }}>{profileOf(frag).join(" · ")}</div>
        <div className="mo-card-actions" style={{ marginTop: "auto", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: CREAM }}>From {money(fromPrice(frag))}</span>
          <button style={{ ...btnLink, fontSize: 9, whiteSpace: "nowrap" }} onClick={() => onQuickView(frag)}>
            Choose size <Arrow size={10} />
          </button>
        </div>
      </div>
    </article>
  );
}

/** Block 5 — what makes buying safe, stated once, above the footer signup. */
function Reassurance() {
  const items: { icon: IconName; title: string; copy: string }[] = [
    { icon: "truck", title: "Free shipping", copy: `Australia-wide on orders over ${shipping}.` },
    { icon: "drop", title: "Try before you commit", copy: "Every scent comes as a 10 ml discovery bottle." },
    { icon: "refresh", title: "30-day returns", copy: "Delivery, payment and returns are set out in Shopping help." },
    { icon: "lock", title: "Secure checkout", copy: "Pay by card through Stripe. No account needed." },
  ];
  return (
    <section aria-label="Why shop with us" style={{ padding: "34px 0", borderBottom: "1px solid #1f1f27" }}>
      <Container>
        <ul className="mo-trust-grid" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 24 }}>
          {items.map((x) => (
            <li key={x.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <Icon name={x.icon} size={20} />
              <div>
                <div style={{ fontFamily: SERIF, fontSize: 19, color: CREAM }}>{x.title}</div>
                <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.55, color: "rgba(243,236,220,0.62)" }}>{x.copy}</div>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
