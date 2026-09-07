import { Art, Container, Arrow, SideCaption } from "./ui";
import { SERIF, MONO, btnGhost } from "./styles";
import { navigate, paths } from "../lib/route";
import { GOLD, CREAM } from "../lib/data";

/** Sections 6 & 7 — Obsidian Drive and Obsidian Ritual. */
export default function RangeBanners() {
  return (
    <section aria-label="Obsidian Drive and Obsidian Ritual" style={{ borderBottom: "1px solid #1f1f27" }}>
      <Container style={{ padding: "22px 32px 24px" }}>
        <div className="mo-banner-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Art src="/assets/banner-drive.jpg" fallback="/assets/bottle-portrait.webp" alt="Obsidian Drive car diffuser" position="left center" style={{ minHeight: 236, border: "1px solid #1f1f27" }} overlay="linear-gradient(90deg, rgba(11,11,13,0.35) 0%, rgba(11,11,13,0.92) 38%, rgba(11,11,13,0.96) 100%)">
            <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "36% 1fr auto", alignItems: "center", padding: "26px 28px 26px 0", gap: 20 }}>
              <span />
              <div>
                <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(243,236,220,0.6)" }}>Maison Obsidian</div>
                <h3 style={{ margin: "6px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 34, color: CREAM, lineHeight: 1 }}>Obsidian Drive</h3>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, marginTop: 8 }}>Fragrance on the move</div>
                <p style={{ margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.7)", maxWidth: 300 }}>The fragrance you wear, now riding with you. Every scent, in our handcrafted wooden-cap car diffuser.</p>
                <button className="mo-ghost" style={{ ...btnGhost, height: 38, marginTop: 16, fontSize: 9.5 }} onClick={() => navigate(paths.car)}>
                  Shop car diffusers <Arrow size={10} />
                </button>
              </div>
              <SideCaption lines={["Same", "iconic scents", "—", "A bolder", "journey"]} style={{ borderLeft: "1px solid rgba(201,169,97,0.3)", paddingLeft: 22 }} />
            </div>
          </Art>
          <Art src="/assets/banner-ritual.jpg" fallback="/assets/bottle-pair.png" alt="Obsidian Ritual body wash and moisturiser" position="right center" style={{ minHeight: 236, border: "1px solid #1f1f27" }} overlay="linear-gradient(90deg, rgba(11,11,13,0.96) 0%, rgba(11,11,13,0.9) 40%, rgba(11,11,13,0.35) 100%)">
            <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 30% auto", alignItems: "center", padding: "26px 28px", gap: 20 }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(243,236,220,0.6)" }}>Maison Obsidian</div>
                <h3 style={{ margin: "6px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 34, color: CREAM, lineHeight: 1 }}>Obsidian Ritual</h3>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, marginTop: 8 }}>Cleanse. Hydrate. Be obsessed.</div>
                <p style={{ margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.7)", maxWidth: 320 }}>Body wash, moisturisers and curated sets for a more fragrant you — from morning to night.</p>
                <button className="mo-ghost" style={{ ...btnGhost, height: 38, marginTop: 16, fontSize: 9.5 }} onClick={() => navigate(paths.body)}>
                  Shop body &amp; sets <Arrow size={10} />
                </button>
              </div>
              <span />
              <SideCaption lines={["Fragrance", "lives", "further"]} style={{ borderLeft: "1px solid rgba(201,169,97,0.3)", paddingLeft: 22 }} />
            </div>
          </Art>
        </div>
      </Container>
    </section>
  );
}
