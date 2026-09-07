import { type Fragrance, type FormatKey, GOLD, CREAM, money } from "../lib/data";
import { profileOf, fromPrice, sku, availableIn, referenceOf } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import BottleImage from "./BottleImage";
import { Arrow, Chip, Icon, InspiredBy } from "./ui";
import { MONO, SERIF, btnLink, micro } from "./styles";

interface FragranceCardProps {
  frag: Fragrance;
  vip: boolean;
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
  /** Discovery box: present when the card can add a 10 ml to the box. */
  inDiscovery?: boolean;
  onToggleDiscovery?: (f: Fragrance) => void;
  /** Format the quick view opens on from "Choose options" (car / body pages). */
  defaultFormat?: FormatKey;
}

/**
 * Collection tile. The hierarchy is the house's: name first, profile second,
 * the reference fragrance only on the product page. Taller photography, less
 * text, format chips and the two actions the brief asks for.
 */
export default function FragranceCard({ frag, vip, onQuickView, inDiscovery, onToggleDiscovery, defaultFormat }: FragranceCardProps) {
  const locked = !!frag.vipOnly && !vip;
  const notes = [frag.top[0], frag.heart[0], frag.base[0]].filter(Boolean).join(" · ");
  const chips: FormatKey[] = ["perf10", "perf30", "perf50"];
  return (
    <article className="mo-card" style={{ border: "1px solid #1f1f27", background: "#101015", display: "flex", flexDirection: "column" }}>
      <button onClick={() => navigate(paths.product(frag.slug))} aria-label={`Open ${frag.name}`} style={{ padding: 0, border: 0, background: "none", cursor: "pointer", position: "relative", display: "block" }}>
        <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-portrait.webp" alt={`${frag.name} bottle`} accent={frag.accent} liquid={frag.liquid} height={300} />
        {frag.vipOnly && (
          <span style={{ position: "absolute", top: 12, left: 12, ...micro, color: GOLD, border: "1px solid rgba(201,169,97,0.5)", background: "rgba(11,11,13,0.8)", padding: "4px 8px" }}>VIP</span>
        )}
      </button>
      <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
        <button onClick={() => navigate(paths.product(frag.slug))} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", fontFamily: SERIF, fontSize: 22, letterSpacing: "0.06em", textTransform: "uppercase", color: CREAM, lineHeight: 1.05 }}>
          {frag.name}
        </button>
        <InspiredBy {...referenceOf(frag)} size="sm" style={{ alignSelf: "flex-start" }} />
        <div style={{ ...micro, color: "rgba(243,236,220,0.75)", fontSize: 8.5 }}>{profileOf(frag).join(" · ")}</div>
        <div style={{ fontSize: 12.5, color: "rgba(243,236,220,0.55)" }}>{notes}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: CREAM }}>From {money(fromPrice(frag))}</span>
          <span style={{ display: "flex", gap: 5 }}>
            {chips.map((k) => {
              const s = sku(frag, k);
              return s.status === "hidden" ? null : (
                <Chip key={k} onClick={() => onQuickView(frag, k)} style={{ height: 22, padding: "0 7px", fontSize: 8.5 }}>{s.def.short}</Chip>
              );
            })}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, ...micro, fontSize: 8, whiteSpace: "nowrap", letterSpacing: "0.14em" }}>
          <span>Available in</span>
          {availableIn(frag).map((a) => (
            <span key={a.group} style={{ color: a.status === "live" ? GOLD : "rgba(243,236,220,0.45)" }}>
              {a.status === "live" ? "◈" : "◇"} {a.label}
            </span>
          ))}
        </div>
        <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <button style={{ ...btnLink, color: locked ? "rgba(243,236,220,0.4)" : GOLD, whiteSpace: "nowrap", fontSize: 9 }} onClick={() => (locked ? navigate(paths.about) : onQuickView(frag, defaultFormat))}>
            {locked ? "VIP members only" : <>Choose options <Arrow size={10} /></>}
          </button>
          {onToggleDiscovery && !locked && (
            <button
              onClick={() => onToggleDiscovery(frag)}
              aria-pressed={!!inDiscovery}
              style={{ background: "none", border: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap", color: inDiscovery ? GOLD : "rgba(243,236,220,0.6)" }}
            >
              <Icon name="heart" size={13} color={inDiscovery ? GOLD : "rgba(243,236,220,0.6)"} />
              {inDiscovery ? "In your box" : "Discovery Box"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
