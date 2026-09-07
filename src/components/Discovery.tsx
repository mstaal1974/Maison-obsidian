import { useMemo } from "react";
import { bottleImage } from "../lib/images";
import { type Fragrance, type FormatKey, GOLD, CREAM, money } from "../lib/data";
import { DISCOVERY_BOX_SIZE, DISCOVERY_BOX_PRICE, profileOf, sku as skuOf } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import BottleImage from "./BottleImage";
import FragranceCard from "./FragranceCard";
import { Arrow, Container } from "./ui";
import { MONO, SERIF, btnGold, btnLink, micro, body } from "./styles";

interface DiscoveryProps {
  fragrances: Fragrance[];
  vip: boolean;
  discoveryIds: string[];
  onToggleDiscovery: (f: Fragrance) => void;
  onAddBox: (frags: Fragrance[]) => void;
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
}

/**
 * Discovery Collection — meet the fragrance before committing to the bottle.
 * 10 ml singles, and the "Build your 5" box (the acquisition mechanic we keep).
 */
export default function Discovery({ fragrances, vip, discoveryIds, onToggleDiscovery, onAddBox, onQuickView }: DiscoveryProps) {
  const picked = useMemo(() => discoveryIds.map((id) => fragrances.find((f) => f.id === id)).filter((f): f is Fragrance => !!f), [discoveryIds, fragrances]);
  const full = picked.length === DISCOVERY_BOX_SIZE;
  const singles = useMemo(() => Math.round(fragrances.reduce((s, f) => s + skuOf(f, "perf10").price, 0) / Math.max(1, fragrances.length)), [fragrances]);

  return (
    <main data-screen-label="Discovery">
      <div style={{ borderBottom: "1px solid #1f1f27", background: "linear-gradient(180deg, #0f0f14, #0b0b0d)" }}>
        <Container style={{ padding: "48px 32px 36px", display: "grid", gridTemplateColumns: "1fr 420px", gap: 40, alignItems: "start" }} >
          <div>
            <div style={{ ...micro, color: GOLD }}>Discovery Collection</div>
            <h1 style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 52, color: CREAM, lineHeight: 1 }}>Meet the fragrance before committing to the bottle.</h1>
            <p style={{ ...body, margin: "14px 0 0", maxWidth: 560 }}>
              Every scent in the house as a 10 ml discovery (around {money(singles)}), or build your own box of {DISCOVERY_BOX_SIZE} for {money(DISCOVERY_BOX_PRICE)}. Wear one for a week. Then choose the 30 ml Everyday Pour or the 50 ml Signature.
            </p>
            <div style={{ display: "flex", gap: 24, marginTop: 22, ...micro }}>
              <span>◈ 10ml singles</span>
              <span>◈ Build your {DISCOVERY_BOX_SIZE}</span>
              <span>◇ Discovery sets · soon</span>
            </div>
          </div>

          {/* Build your 5 */}
          <aside aria-label="Your Discovery Box" style={{ border: `1px solid ${full ? GOLD : "rgba(201,169,97,0.4)"}`, background: "#101015", padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontFamily: SERIF, fontSize: 26, color: CREAM }}>The Discovery Box</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: GOLD }}>{picked.length} / {DISCOVERY_BOX_SIZE}</div>
            </div>
            <div style={{ ...micro, marginTop: 4 }}>Five fragrances. Your choice. {money(DISCOVERY_BOX_PRICE)}.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 16 }}>
              {Array.from({ length: DISCOVERY_BOX_SIZE }).map((_, i) => {
                const f = picked[i];
                return f ? (
                  <button key={f.id} onClick={() => onToggleDiscovery(f)} title={`Remove ${f.name}`} style={{ padding: 0, border: "1px solid rgba(201,169,97,0.6)", background: "none", cursor: "pointer" }}>
                    <BottleImage imageUrl={bottleImage(f)} fallbackSrc="/assets/bottle-square.jpg" alt={f.name} accent={f.accent} liquid={f.liquid} height={76} />
                  </button>
                ) : (
                  <span key={i} aria-hidden style={{ height: 76, border: "1px dashed #2a2a33", display: "grid", placeItems: "center", color: "rgba(243,236,220,0.3)", fontFamily: MONO, fontSize: 10 }}>{i + 1}</span>
                );
              })}
            </div>
            <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
              {picked.map((f) => (
                <li key={f.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "rgba(243,236,220,0.8)" }}>
                  <span>{f.name}</span>
                  <span style={{ ...micro, fontSize: 8 }}>{profileOf(f).slice(0, 2).join(" · ")}</span>
                </li>
              ))}
            </ul>
            <button className="mo-cta" style={{ ...btnGold, width: "100%", justifyContent: "center", marginTop: 16, opacity: full ? 1 : 0.5 }} disabled={!full} onClick={() => onAddBox(picked)}>
              {full ? `Add box to bag · ${money(DISCOVERY_BOX_PRICE)}` : `Choose ${DISCOVERY_BOX_SIZE - picked.length} more`} <Arrow />
            </button>
            <button style={{ ...btnLink, marginTop: 12, justifyContent: "center", width: "100%" }} onClick={() => navigate(paths.find())}>Not sure? Find your scent <Arrow size={10} /></button>
          </aside>
        </Container>
      </div>

      <Container style={{ padding: "26px 32px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 28, color: CREAM }}>10ml singles</h2>
          <span style={{ ...micro }}>Tap ♡ to add to your box · “Choose options” for a single</span>
        </div>
        <div className="mo-vault-grid" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {fragrances.map((f) => (
            <FragranceCard key={f.id} frag={f} vip={vip} onQuickView={onQuickView} defaultFormat="perf10" inDiscovery={discoveryIds.includes(f.id)} onToggleDiscovery={onToggleDiscovery} />
          ))}
        </div>
      </Container>
    </main>
  );
}
