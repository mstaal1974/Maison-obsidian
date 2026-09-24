import { useMemo } from "react";
import { type Fragrance, type FormatKey, CREAM, GOLD } from "../lib/data";
import { NEW_DAYS, newArrivals } from "../lib/launch";
import { navigate, paths } from "../lib/route";
import { usePageMeta } from "../lib/seo";
import FragranceCard from "./FragranceCard";
import { Arrow, Container } from "./ui";
import { SERIF, btnGhost, btnLink, micro } from "./styles";

interface Props {
  fragrances: Fragrance[];
  vip: boolean;
  discoveryIds: string[];
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
  onToggleDiscovery: (f: Fragrance) => void;
}

const body = { fontSize: 15, lineHeight: 1.6, color: "rgba(243,236,220,0.65)" } as const;

/** /new: everything launched in the last NEW_DAYS days, newest first. */
export default function NewArrivals({ fragrances, vip, discoveryIds, onQuickView, onToggleDiscovery }: Props) {
  const list = useMemo(() => newArrivals(fragrances), [fragrances]);
  usePageMeta({
    title: "New arrivals | Maison Obsidian",
    description: "The latest fragrances from Maison Obsidian, freshly poured in small batches. Meet them in 10 ml or go straight to the 50 ml.",
    path: paths.newArrivals,
  });

  return (
    <main data-screen-label="New arrivals">
      <Container style={{ padding: "48px 32px 18px" }}>
        <div style={{ ...micro, color: GOLD }}>Just poured</div>
        <h1 style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 48, color: CREAM, lineHeight: 1 }}>New arrivals.</h1>
        <p style={{ ...body, margin: "12px 0 0", maxWidth: 560 }}>
          The latest scents from the lab, newest first. Each is marked New for its first {NEW_DAYS} days.
        </p>
      </Container>
      <Container style={{ padding: "8px 32px 60px" }}>
        {list.length === 0 ? (
          <div style={{ borderTop: "1px solid #1f1f27", paddingTop: 26 }}>
            <p style={{ ...body, margin: 0 }}>Nothing new this month. The next pour is on its way.</p>
            <button className="mo-ghost" style={{ ...btnGhost, marginTop: 18 }} onClick={() => navigate(paths.fragrances)}>
              Explore the collection <Arrow />
            </button>
          </div>
        ) : (
          <div className="mo-vault-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {list.map((f) => (
              <FragranceCard key={f.id} frag={f} vip={vip} onQuickView={onQuickView} inDiscovery={discoveryIds.includes(f.id)} onToggleDiscovery={onToggleDiscovery} />
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}

/** Home page row: up to four of the newest, only when there are any. */
export function JustPoured({ fragrances, vip, discoveryIds, onQuickView, onToggleDiscovery }: Props) {
  const list = useMemo(() => newArrivals(fragrances).slice(0, 4), [fragrances]);
  if (!list.length) return null;
  return (
    <section aria-label="New arrivals" style={{ borderBottom: "1px solid #1f1f27" }}>
      <Container style={{ padding: "34px 32px 36px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ ...micro, color: GOLD }}>New arrivals</div>
            <h2 style={{ margin: "8px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 36, color: CREAM, lineHeight: 1.05 }}>Just poured.</h2>
          </div>
          <button style={btnLink} onClick={() => navigate(paths.newArrivals)}>
            See all new arrivals <Arrow size={10} />
          </button>
        </div>
        <div className="mo-vault-grid" style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {list.map((f) => (
            <FragranceCard key={f.id} frag={f} vip={vip} onQuickView={onQuickView} inDiscovery={discoveryIds.includes(f.id)} onToggleDiscovery={onToggleDiscovery} />
          ))}
        </div>
      </Container>
    </section>
  );
}
