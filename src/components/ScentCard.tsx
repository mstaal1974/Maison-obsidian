import { type Fragrance, type FormatKey, GOLD, CREAM, money } from "../lib/data";
import { profileOf, fromPrice, sku, referenceOf } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import BottleImage from "./BottleImage";
import { Arrow, Chip, InspiredBy } from "./ui";
import { MONO, SERIF, btnLink, micro } from "./styles";

interface ScentCardProps {
  frag: Fragrance;
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
}

/**
 * Horizontal card from the homepage "Shop by mood" row: bottle left, then the
 * house name, three-word profile, headline notes, the format chips and a price
 * from the cheapest live SKU. Tapping a chip opens the format drawer with that
 * option preselected; "Add to bag" opens it on the signature 50 ml.
 */
export default function ScentCard({ frag, onQuickView }: ScentCardProps) {
  const chips: FormatKey[] = ["perf10", "perf30", "perf50", "car"];
  const notes = [frag.top[0], frag.heart[0], frag.base[0]].filter(Boolean).join(", ");
  return (
    <article className="mo-card" style={{ border: "1px solid #1f1f27", background: "#101015", display: "grid", gridTemplateColumns: "150px 1fr", minHeight: 176 }}>
      <button onClick={() => navigate(paths.product(frag.slug))} aria-label={`Open ${frag.name}`} style={{ padding: 0, border: 0, background: "none", cursor: "pointer", borderRight: "1px solid #1f1f27" }}>
        <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-square.jpg" alt={`${frag.name} bottle`} accent={frag.accent} liquid={frag.liquid} height="100%" objectPosition="center 40%" />
      </button>
      <div style={{ padding: "16px 18px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={() => navigate(paths.product(frag.slug))} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", fontFamily: SERIF, fontSize: 22, color: CREAM, lineHeight: 1.05 }}>
          {frag.name}
        </button>
        <InspiredBy {...referenceOf(frag)} size="sm" style={{ alignSelf: "flex-start" }} />
        <div style={{ ...micro, color: "rgba(243,236,220,0.78)", fontSize: 8.5 }}>{profileOf(frag).join(" · ")}</div>
        <div style={{ fontSize: 12, color: "rgba(243,236,220,0.55)", lineHeight: 1.45, textTransform: "lowercase" }}>{notes}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
          {chips.map((k) => {
            const s = sku(frag, k);
            if (s.status === "hidden") return null;
            return (
              <Chip key={k} onClick={() => onQuickView(frag, k)} style={{ opacity: s.status === "live" ? 1 : 0.5 }}>
                {s.def.short}
              </Chip>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 13, color: CREAM }}>{money(fromPrice(frag))}+</span>
          <button style={{ ...btnLink, color: GOLD }} onClick={() => onQuickView(frag, "perf50")}>
            Add to bag <Arrow size={10} />
          </button>
        </div>
      </div>
    </article>
  );
}
