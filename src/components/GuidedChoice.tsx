import { useState } from "react";
import { Container, Arrow } from "./ui";
import { h2, micro, MONO, SERIF } from "./styles";
import { navigate, paths } from "../lib/route";
import { GOLD, CREAM, money } from "../lib/data";
import { DISCOVERY_BOX_PRICE, DISCOVERY_BOX_SIZE } from "../lib/formats";

const card = {
  border: "1px solid #1f1f27",
  background: "#101015",
  padding: "26px 24px 24px",
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  textAlign: "left" as const,
  color: CREAM,
};

/**
 * Home, block 2 — one question: how would you like to choose? Each route is
 * a single entry point; the matcher, the Scent DNA quiz and the Discovery Box
 * each keep their full experience on their own page.
 */
export default function GuidedChoice() {
  const [loved, setLoved] = useState("");
  return (
    <section aria-label="How would you like to choose?" style={{ padding: "40px 0 36px", borderBottom: "1px solid #1f1f27" }}>
      <Container>
        <h2 style={h2}>How would you like to choose?</h2>
        <div className="mo-guided-grid" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <form
            style={card}
            onSubmit={(e) => {
              e.preventDefault();
              navigate(paths.find(loved.trim()));
            }}
          >
            <span style={{ ...micro, color: GOLD }}>I know what I love</span>
            <span style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1.1 }}>Match a fragrance you already wear</span>
            <label style={{ display: "flex", borderBottom: "1px solid rgba(201,169,97,0.5)", marginTop: "auto", paddingTop: 12 }}>
              <span className="mo-sr-only">A fragrance you love</span>
              <input
                value={loved}
                onChange={(e) => setLoved(e.target.value)}
                placeholder="e.g. Black Opium"
                style={{ flex: 1, minWidth: 0, background: "none", border: 0, outline: "none", color: CREAM, fontFamily: SERIF, fontSize: 18, padding: "6px 0" }}
              />
              <button type="submit" aria-label="Find my match" style={{ background: "none", border: 0, color: GOLD, cursor: "pointer" }}>
                <Arrow />
              </button>
            </label>
          </form>

          <button className="mo-card" style={{ ...card, cursor: "pointer", font: "inherit" }} onClick={() => navigate(paths.discover)}>
            <span style={{ ...micro, color: GOLD }}>Help me choose</span>
            <span style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1.1 }}>Discover your scent profile</span>
            <span style={{ fontSize: 13, lineHeight: 1.55, color: "rgba(243,236,220,0.65)" }}>A two-minute Scent DNA quiz that recommends scents for you.</span>
            <span style={{ marginTop: "auto", paddingTop: 12, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: GOLD, display: "inline-flex", gap: 8, alignItems: "center" }}>
              Start Scent DNA <Arrow size={10} />
            </span>
          </button>

          <button className="mo-card" style={{ ...card, cursor: "pointer", font: "inherit" }} onClick={() => navigate(paths.discovery)}>
            <span style={{ ...micro, color: GOLD }}>I want to explore</span>
            <span style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1.1 }}>Try {DISCOVERY_BOX_SIZE} scents before a full bottle</span>
            <span style={{ fontSize: 13, lineHeight: 1.55, color: "rgba(243,236,220,0.65)" }}>Choose {DISCOVERY_BOX_SIZE} × 10 ml for a Discovery Box — {money(DISCOVERY_BOX_PRICE)}.</span>
            <span style={{ marginTop: "auto", paddingTop: 12, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: GOLD, display: "inline-flex", gap: 8, alignItems: "center" }}>
              Build a Discovery Box <Arrow size={10} />
            </span>
          </button>
        </div>
      </Container>
    </section>
  );
}
