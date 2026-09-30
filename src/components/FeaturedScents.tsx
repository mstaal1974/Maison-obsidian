import { useEffect, useMemo } from "react";
import { type Fragrance, type FormatKey } from "../lib/data";
import { fromPrice } from "../lib/formats";
import { featured, FEATURED_FROM_SALES, FEATURED_LABEL } from "../lib/merchandising";
import { paths } from "../lib/route";
import { trackViewItemList } from "../lib/analytics";
import FragranceCard from "./FragranceCard";
import { Arrow, Container } from "./ui";
import { btnLink, h2 } from "./styles";

/** Home, block 3 — four scents to start with, one action each. */
export default function FeaturedScents({ fragrances, vip, onQuickView }: { fragrances: Fragrance[]; vip: boolean; onQuickView: (f: Fragrance, format?: FormatKey) => void }) {
  const list = useMemo(() => featured(fragrances), [fragrances]);
  const ids = list.map((f) => f.id).join(",");
  useEffect(() => {
    trackViewItemList("home_featured", list.map((f) => ({ id: f.id, name: f.name, priceCents: fromPrice(f) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  if (!list.length) return null;
  return (
    <section aria-label={FEATURED_LABEL} style={{ padding: "38px 0 36px", borderBottom: "1px solid #1f1f27" }}>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={h2}>{FEATURED_LABEL}</h2>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "rgba(243,236,220,0.6)" }}>
              {FEATURED_FROM_SALES ? "What other shoppers start with." : "Four fragrances that define the house."}
            </p>
          </div>
          <a href={paths.fragrances} style={{ ...btnLink, textDecoration: "none" }}>
            All fragrances <Arrow size={10} />
          </a>
        </div>
        <div className="mo-featured-grid" style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {list.map((f) => (
            <FragranceCard key={f.id} frag={f} vip={vip} onQuickView={onQuickView} listName="home_featured" />
          ))}
        </div>
      </Container>
    </section>
  );
}
