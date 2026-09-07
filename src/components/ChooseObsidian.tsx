import { Art, Container, Arrow } from "./ui";
import { h2, micro, SERIF, MONO } from "./styles";
import { navigate, paths } from "../lib/route";
import { GOLD, CREAM } from "../lib/data";

const TILES = [
  { key: "discover", title: "Discover", sub: "Samples & sets", src: "/assets/tile-discover.jpg", fallback: "/assets/bottle-square.jpg", to: paths.discovery },
  { key: "wear", title: "Wear", sub: "Eau de Parfum", src: "/assets/tile-wear.jpg", fallback: "/assets/bottle-pdp.jpg", to: paths.fragrances },
  { key: "drive", title: "Drive", sub: "Car diffusers", src: "/assets/tile-drive.jpg", fallback: "/assets/bottle-portrait.webp", to: paths.car },
  { key: "ritual", title: "Ritual", sub: "Body & bath", src: "/assets/tile-ritual.jpg", fallback: "/assets/bottle-pair.png", to: paths.body },
];

/** Section 2 — the four Maison Obsidian ranges. Explains the business at a glance. */
export default function ChooseObsidian() {
  return (
    <section aria-label="Choose your Obsidian" style={{ padding: "34px 0 22px", borderBottom: "1px solid #1f1f27" }}>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 20, flexWrap: "wrap" }}>
          <h2 style={h2}>Choose your Obsidian</h2>
          <span style={{ ...micro, color: "rgba(243,236,220,0.6)" }}>Different worlds. A bolder you.</span>
        </div>
        <div className="mo-choose-grid" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {TILES.map((t) => (
            <button key={t.key} className="mo-card" onClick={() => navigate(t.to)} style={{ padding: 0, border: "1px solid #1f1f27", background: "none", cursor: "pointer", textAlign: "left" }}>
              <Art src={t.src} fallback={t.fallback} alt="" position="center" style={{ height: 150 }} overlay="linear-gradient(90deg, rgba(11,11,13,0.92) 0%, rgba(11,11,13,0.55) 45%, rgba(11,11,13,0.1) 100%)">
                <div style={{ position: "absolute", inset: 0, padding: "24px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontFamily: SERIF, fontSize: 24, letterSpacing: "0.12em", textTransform: "uppercase", color: CREAM }}>{t.title}</div>
                    <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", color: GOLD, marginTop: 6 }}>{t.sub}</div>
                  </div>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid rgba(201,169,97,0.7)", display: "grid", placeItems: "center", color: GOLD }}>
                    <Arrow size={10} />
                  </span>
                </div>
              </Art>
            </button>
          ))}
        </div>
      </Container>
    </section>
  );
}
