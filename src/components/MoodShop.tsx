import { useMemo, useState } from "react";
import { type Fragrance, type FormatKey, GOLD, CREAM } from "../lib/data";
import { MOODS, type Mood, moodsOf } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import ScentCard from "./ScentCard";
import { Arrow, Container } from "./ui";
import { MONO, SERIF, btnLink } from "./styles";

interface MoodShopProps {
  fragrances: Fragrance[];
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
}

const SHOWN: Mood[] = ["Woody", "Fresh", "Spicy", "Dark", "Clean", "Floral"];

/** Section 4 — find it by mood. Gender is a filter elsewhere; mood leads here. */
export default function MoodShop({ fragrances, onQuickView }: MoodShopProps) {
  const [mood, setMood] = useState<Mood | null>(null);
  const shown = useMemo(() => {
    const list = mood ? fragrances.filter((f) => moodsOf(f).includes(mood)) : fragrances;
    return list.slice(0, 4);
  }, [fragrances, mood]);

  return (
    <section aria-label="Shop by mood" style={{ borderBottom: "1px solid #1f1f27" }}>
      <Container style={{ padding: "26px 32px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 30, color: CREAM, marginRight: 8 }}>Shop by mood</h2>
          {SHOWN.map((id) => {
            const m = MOODS.find((x) => x.id === id)!;
            const active = mood === id;
            return (
              <button
                key={id}
                onClick={() => setMood(active ? null : id)}
                aria-pressed={active}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  height: 40,
                  padding: "0 18px 0 6px",
                  borderRadius: 999,
                  border: `1px solid ${active ? GOLD : "rgba(243,236,220,0.28)"}`,
                  background: active ? "rgba(201,169,97,0.12)" : "none",
                  color: CREAM,
                  cursor: "pointer",
                  fontFamily: SERIF,
                  fontSize: 15,
                }}
              >
                <span aria-hidden style={{ width: 28, height: 28, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${m.swatch}ee, #0b0b0d)` }} />
                {id}
              </button>
            );
          })}
          <button style={{ ...btnLink, marginLeft: "auto", fontFamily: MONO }} onClick={() => navigate(paths.fragrances)}>
            View all fragrances <Arrow size={10} />
          </button>
        </div>
        <div className="mo-mood-grid" style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {shown.map((f) => (
            <ScentCard key={f.id} frag={f} onQuickView={onQuickView} />
          ))}
          {shown.length === 0 && <p style={{ gridColumn: "1 / -1", fontSize: 13, color: "rgba(243,236,220,0.6)" }}>Nothing in this mood yet — try another.</p>}
        </div>
      </Container>
    </section>
  );
}
