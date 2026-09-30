import { Container, Icon, type IconName } from "./ui";
import { MONO, SERIF } from "./styles";
import { CREAM, GOLD } from "../lib/data";
import { paths } from "../lib/route";

// Only things that are true of every order today.
const POINTS: { icon: IconName; title: string; copy: string }[] = [
  { icon: "drop", title: "Try before you commit", copy: "Every scent comes in 10 ml, on its own or in a Discovery Box." },
  { icon: "truck", title: "Free standard post over $100", copy: "Postage is quoted by Australia Post before you pay." },
  { icon: "refresh", title: "30-day returns", copy: "If it isn't right, send it back within 30 days." },
  { icon: "lock", title: "Secure checkout", copy: "Paid through Stripe. No account needed — check out as a guest." },
];

/** Home, block 5 — the reassurance that makes buying feel safe, just above the footer. */
export default function TrustBlock() {
  return (
    <section aria-label="Buying from Maison Obsidian" style={{ padding: "34px 0", borderBottom: "1px solid #1f1f27", background: "#0d0d11" }}>
      <Container>
        <div className="mo-trust-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
          {POINTS.map((p) => (
            <div key={p.title} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 12, alignItems: "start" }}>
              <Icon name={p.icon} size={20} color={GOLD} />
              <div>
                <div style={{ fontFamily: SERIF, fontSize: 19, color: CREAM }}>{p.title}</div>
                <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.55, color: "rgba(243,236,220,0.62)" }}>{p.copy}</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin: "18px 0 0", fontFamily: MONO, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(243,236,220,0.5)" }}>
          <a href={paths.help} style={{ color: GOLD }}>Delivery, payment &amp; returns</a>
        </p>
      </Container>
    </section>
  );
}
