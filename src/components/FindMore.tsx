import { type Fragrance, type FormatKey, GOLD, CREAM } from "../lib/data";
import { navigate, paths } from "../lib/route";
import MoodShop from "./MoodShop";
import { Arrow, Container } from "./ui";
import { btnGhost, micro, SERIF } from "./styles";

/**
 * Below the matcher on /find: the other two ways to choose, for a shopper
 * who doesn't have a fragrance to name — the Scent DNA quiz, and browsing by
 * mood (moved here from the homepage).
 */
export default function FindMore({ fragrances, onQuickView }: { fragrances: Fragrance[]; onQuickView: (f: Fragrance, format?: FormatKey) => void }) {
  return (
    <>
      <section aria-label="Scent DNA" style={{ borderTop: "1px solid #1f1f27", borderBottom: "1px solid #1f1f27" }}>
        <Container style={{ padding: "30px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ ...micro, color: GOLD }}>No fragrance in mind?</div>
            <div style={{ fontFamily: SERIF, fontSize: 28, color: CREAM, marginTop: 6 }}>Take the two-minute Scent DNA quiz instead.</div>
          </div>
          <button className="mo-ghost" style={btnGhost} onClick={() => navigate(paths.discover)}>
            Start Scent DNA <Arrow size={10} />
          </button>
        </Container>
      </section>
      <MoodShop fragrances={fragrances} onQuickView={onQuickView} />
    </>
  );
}
