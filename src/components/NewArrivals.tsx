import { useMemo } from "react";
import { type Fragrance, type FormatKey, CREAM, GOLD } from "../lib/data";
import { NEW_DAYS, launchLabel, newArrivals, upcoming } from "../lib/launch";
import { navigate, paths } from "../lib/route";
import { usePageMeta } from "../lib/seo";
import BottleImage from "./BottleImage";
import FragranceCard from "./FragranceCard";
import { bottleBackdrop } from "./adminStyles";
import { Arrow, Container } from "./ui";
import { MONO, SERIF, btnGhost, btnLink, micro } from "./styles";

interface Props {
  fragrances: Fragrance[];
  vip: boolean;
  discoveryIds: string[];
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
  onToggleDiscovery: (f: Fragrance) => void;
  /** The whole catalogue, for the Coming soon row (only future launches show). */
  upcoming?: Fragrance[];
}

const body = { fontSize: 15, lineHeight: 1.6, color: "rgba(243,236,220,0.65)" } as const;

/** /new: everything launched in the last NEW_DAYS days, newest first. */
export default function NewArrivals({ fragrances, vip, discoveryIds, onQuickView, onToggleDiscovery, upcoming: all = [] }: Props) {
  const list = useMemo(() => newArrivals(fragrances), [fragrances]);
  const soon = useMemo(() => upcoming(all), [all]);
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
      {soon.length > 0 && (
        <Container style={{ padding: "0 32px 60px" }}>
          <div style={{ borderTop: "1px solid #1f1f27", paddingTop: 26 }}>
            <div style={{ ...micro, color: GOLD }}>Coming soon</div>
            <h2 style={{ margin: "8px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 32, color: CREAM }}>On the bench.</h2>
            <p style={{ ...body, margin: "8px 0 0", maxWidth: 560 }}>Not poured yet. Open one to read about it and hear the day it arrives.</p>
          </div>
          <div className="mo-vault-grid" style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {soon.map((f) => (
              <TeaserCard key={f.id} frag={f} />
            ))}
          </div>
        </Container>
      )}
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

/** A fragrance before launch: no price, no bag; opens its teaser page. */
function TeaserCard({ frag }: { frag: Fragrance }) {
  return (
    <a
      href={paths.product(frag.slug)}
      className="mo-teaser-card"
      style={{ display: "block", border: "1px solid #1f1f27", background: "#101015", color: CREAM, textDecoration: "none" }}
    >
      <span style={{ display: "block", position: "relative", background: bottleBackdrop(frag.accent, frag.liquid), borderBottom: "1px solid #1f1f27" }}>
        <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-square.jpg" alt={`${frag.name} bottle`} accent={frag.accent} liquid={frag.liquid} height={220} />
        <span style={{ position: "absolute", top: 10, right: 10, ...micro, fontSize: 9, color: "#0b0b0d", background: GOLD, padding: "3px 8px", letterSpacing: "0.2em", fontWeight: 600 }}>Coming {launchLabel(frag)}</span>
      </span>
      <span style={{ display: "block", padding: "12px 14px 14px" }}>
        <span style={{ display: "block", fontFamily: SERIF, fontSize: 22 }}>{frag.name}</span>
        <span style={{ display: "block", fontSize: 12.5, color: "rgba(243,236,220,0.55)", marginTop: 4 }}>{frag.tagline}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 10, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD }}>
          Notify me <Arrow size={10} />
        </span>
      </span>
    </a>
  );
}
