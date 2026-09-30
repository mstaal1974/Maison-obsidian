import { Art, Arrow } from "./ui";
import { btnGold, MONO, SERIF } from "./styles";
import { navigate, paths } from "../lib/route";
import { CREAM, GOLD } from "../lib/data";
import { FEATURED_FROM_SALES } from "../lib/merchandising";

/**
 * Hero — one promise, one primary action, one quiet way to get help, and one
 * line of reassurance. The formats are named once, in the promise; choosing
 * between them waits until a scent has been chosen.
 */
export default function Hero() {
  return (
    <section aria-label="Hero" style={{ borderBottom: "1px solid #1f1f27" }}>
      <Art
        src="/assets/hero-lineup.jpg"
        fallback="/assets/bottle-pair.png"
        alt="Maison Obsidian eau de parfum, discovery bottle, car diffuser and body care"
        position="right center"
        priority
        style={{ minHeight: 520 }}
        overlay="linear-gradient(90deg, rgba(11,11,13,0.96) 0%, rgba(11,11,13,0.82) 32%, rgba(11,11,13,0.25) 60%, rgba(11,11,13,0.15) 100%), linear-gradient(0deg, rgba(11,11,13,0.7) 0%, transparent 30%)"
      >
        <div className="mo-hero-grid" style={{ position: "relative", maxWidth: 1400, margin: "0 auto", padding: "64px 32px 58px", display: "flex", alignItems: "flex-end", minHeight: 520 }}>
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
              <button className="mo-cta" style={{ ...btnGold, height: 52, padding: "0 30px" }} onClick={() => navigate(paths.fragrances)}>
                {FEATURED_FROM_SALES ? "Shop best sellers" : "Shop the fragrances"} <Arrow />
              </button>
              <a href={paths.find()} style={{ color: CREAM, fontFamily: SERIF, fontSize: 18, textDecoration: "underline", textUnderlineOffset: 5, textDecorationColor: "rgba(201,169,97,0.6)" }}>
                Help me find my scent
              </a>
            </div>
            <p style={{ margin: "26px 0 0", fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.2em", textTransform: "uppercase", color: GOLD }}>
              10 ml samples · Free standard post over $100 · 30-day returns
            </p>
          </div>
        </div>
      </Art>
    </section>
  );
}
