import { Art, SideCaption, Arrow } from "./ui";
import { btnGold, btnGhost, SERIF } from "./styles";
import { navigate, paths } from "../lib/route";
import { CREAM } from "../lib/data";

/**
 * Hero — "Wear it. Live it. Take it with you." over the full lineup: 50 ml,
 * 30 ml, discovery, car diffuser, body wash and moisturiser. Drop the comp's
 * lineup shot in as /assets/hero-lineup.jpg; until then the stock pair stands in.
 */
export default function Hero() {
  return (
    <section aria-label="Hero" style={{ borderBottom: "1px solid #1f1f27" }}>
      <Art
        src="/assets/hero.jpg"
        fallback="/assets/bottle-pair.png"
        alt="Maison Obsidian eau de parfum, discovery bottle, car diffuser and body care"
        position="72% 40%"
        style={{ minHeight: 520 }}
        overlay="linear-gradient(90deg, rgba(11,11,13,0.96) 0%, rgba(11,11,13,0.82) 32%, rgba(11,11,13,0.25) 60%, rgba(11,11,13,0.15) 100%), linear-gradient(0deg, rgba(11,11,13,0.7) 0%, transparent 30%)"
      >
        <div className="mo-hero-grid" style={{ position: "relative", maxWidth: 1400, margin: "0 auto", padding: "64px 32px 58px", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "end", minHeight: 520, gap: 40 }}>
          <div className="mo-rise" style={{ maxWidth: 560 }}>
            <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(44px, 5.4vw, 76px)", lineHeight: 1.02, color: CREAM, letterSpacing: "-0.01em" }}>
              Wear it. Live it.
              <br />
              Take it with you.
            </h1>
            <p style={{ margin: "26px 0 0", fontFamily: SERIF, fontSize: 21, color: "rgba(243,236,220,0.9)", lineHeight: 1.35 }}>Iconic fragrances. Now for every part of your world.</p>
            <p style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: 16, color: "rgba(243,236,220,0.6)", letterSpacing: "0.04em" }}>Eau de Parfum · Discovery · Car · Body · Sets</p>
            <div style={{ display: "flex", gap: 14, marginTop: 34, flexWrap: "wrap" }}>
              <button className="mo-cta" style={btnGold} onClick={() => navigate(paths.shop())}>
                Shop all <Arrow />
              </button>
              <button className="mo-ghost" style={btnGhost} onClick={() => navigate(paths.fragrances)}>
                Discover the collection
              </button>
            </div>
          </div>
          <SideCaption lines={["Fragrance", "beyond", "boundaries", "—", "A bolder", "you"]} style={{ alignSelf: "start", marginTop: 40, padding: "18px 20px", background: "rgba(11,11,13,0.62)", backdropFilter: "blur(4px)" }} />
        </div>
      </Art>
    </section>
  );
}
