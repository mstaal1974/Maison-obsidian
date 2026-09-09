import { Container, Arrow } from "./ui";
import { SERIF, MONO, btnGold } from "./styles";
import { navigate, paths } from "../lib/route";
import { GOLD, CREAM } from "../lib/data";
import { SUBSCRIPTION_MONTHS } from "../lib/subscription";

/** Home: the Monthly Pour in one band between the mood shop and the range banners. */
export default function SubscribeBand() {
  return (
    <section aria-label="The Monthly Pour" style={{ borderBottom: "1px solid #1f1f27", background: "linear-gradient(135deg, rgba(201,169,97,0.08), transparent 55%)" }}>
      <Container style={{ padding: "36px 32px" }}>
        <div className="mo-band-grid" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD }}>The Monthly Pour · {SUBSCRIPTION_MONTHS}-month subscription</div>
            <h2 style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 36, color: CREAM, lineHeight: 1.05 }}>A new scent every month. Ten percent off, always.</h2>
            <p style={{ margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.65, color: "rgba(243,236,220,0.65)", maxWidth: 620 }}>
              Choose a 10, 30 or 50 ml Eau de Parfum or the car diffuser. Pick your fragrance each month, and pay 10% under the shelf price, billed monthly.
            </p>
          </div>
          <button className="mo-cta" style={btnGold} onClick={() => navigate(paths.subscribe())}>
            Build my Monthly Pour <Arrow />
          </button>
        </div>
      </Container>
    </section>
  );
}
