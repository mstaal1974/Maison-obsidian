import Method from "./Method";
import VIP from "./VIP";
import { Container } from "./ui";
import { SERIF, micro, body } from "./styles";
import { GOLD, CREAM } from "../lib/data";

interface AboutProps {
  vip: boolean;
  signedIn: boolean;
  onJoin: () => void;
}

/** The house: the nomenclature, the method, and the VIP club. */
export default function About({ vip, signedIn, onJoin }: AboutProps) {
  const RANGES = [
    ["Discover", "10ml", "Meet the fragrance before the bottle."],
    ["Signature", "30ml / 50ml", "The Everyday Pour and the Signature Pour."],
    ["Drive", "Car diffusers", "The scent you wear, riding with you."],
    ["Ritual", "Body", "Wash, moisturise, layer."],
    ["Sets", "Bundles", "The Duo, the Ritual, the Signature Ritual."],
    ["The Vault", "Library", "3,000+ fragrance profiles we can source."],
    ["Find your Obsidian", "Match", "Tell us what you love; we suggest yours."],
  ];
  return (
    <main data-screen-label="About">
      <Container style={{ padding: "48px 32px 20px" }}>
        <div style={{ ...micro, color: GOLD }}>The House</div>
        <h1 style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 52, color: CREAM, lineHeight: 1 }}>One scent. Every part of your day.</h1>
        <p style={{ ...body, margin: "14px 0 0", maxWidth: 620 }}>Discover it. Wear it. Drive with it. Live in it. Maison Obsidian is a batch atelier: each fragrance is poured in small numbers and offered in every format your day needs.</p>
        <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {RANGES.map(([name, fmt, copy]) => (
            <div key={name} style={{ border: "1px solid #1f1f27", padding: 16 }}>
              <div style={{ fontFamily: SERIF, fontSize: 22, letterSpacing: "0.08em", textTransform: "uppercase", color: CREAM }}>{name}</div>
              <div style={{ ...micro, color: GOLD, marginTop: 4 }}>{fmt}</div>
              <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "rgba(243,236,220,0.6)" }}>{copy}</p>
            </div>
          ))}
        </div>
      </Container>
      <Method />
      <VIP vip={vip} signedIn={signedIn} onJoin={onJoin} />
    </main>
  );
}
