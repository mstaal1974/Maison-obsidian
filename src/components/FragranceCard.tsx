import { type Fragrance, type FormatKey, GOLD, CREAM, money } from "../lib/data";
import { profileOf, fromPrice, experienceOf } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import { trackSelectItem } from "../lib/analytics";
import { isNew } from "../lib/launch";
import BottleImage from "./BottleImage";
import { Arrow, Icon } from "./ui";
import { MONO, SERIF, btnLink, micro } from "./styles";

interface FragranceCardProps {
  frag: Fragrance;
  vip: boolean;
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
  /** Discovery box: present when the card can add a 10 ml to the box (the Discovery page). */
  inDiscovery?: boolean;
  onToggleDiscovery?: (f: Fragrance) => void;
  /** Format the quick view opens on from "Choose size" (car / body / 10 ml pages). */
  defaultFormat?: FormatKey;
  /** GA list name for select_item, e.g. "home_signatures". */
  listName?: string;
}

/**
 * Collection tile, kept to what separates one scent from the next: what it
 * smells like, when to wear it, and where the price starts. Notes, the
 * reference fragrance, formats and availability live in quick view and on the
 * product page. One badge at most, and only a factual one.
 */
export default function FragranceCard({ frag, vip, onQuickView, inDiscovery, onToggleDiscovery, defaultFormat, listName }: FragranceCardProps) {
  const locked = !!frag.vipOnly && !vip;
  const occasion = experienceOf(frag)[1]?.label; // "Evening" / "Daytime"
  const badge = frag.vipOnly ? "VIP" : isNew(frag) ? "New" : null;
  // Real links, so crawlers can follow the collection to every product page;
  // interceptLinks() (lib/route) keeps the click in the app.
  const href = paths.product(frag.slug);
  const select = () => trackSelectItem({ id: frag.id, name: frag.name }, listName);
  const action = defaultFormat === "car" || defaultFormat === "wash" ? "Choose options" : "Choose size";
  return (
    <article className="mo-card" style={{ border: "1px solid #1f1f27", background: "#101015", display: "flex", flexDirection: "column" }}>
      <a className="mo-card-photo" href={href} onClick={select} tabIndex={-1} aria-hidden="true" style={{ position: "relative", display: "block" }}>
        <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-portrait.webp" alt={`${frag.name} bottle`} accent={frag.accent} liquid={frag.liquid} height={300} />
        {badge && (
          <span
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              ...micro,
              fontWeight: 600,
              padding: "4px 8px",
              ...(badge === "New" ? { color: "#0b0b0d", background: GOLD } : { color: GOLD, border: "1px solid rgba(201,169,97,0.5)", background: "rgba(11,11,13,0.8)" }),
            }}
          >
            {badge}
          </span>
        )}
      </a>
      <div className="mo-card-body" style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <a className="mo-card-name" href={href} onClick={select} style={{ display: "block", textDecoration: "none", fontFamily: SERIF, fontSize: 22, letterSpacing: "0.06em", textTransform: "uppercase", color: CREAM, lineHeight: 1.05 }}>
          {frag.name}
        </a>
        <div style={{ fontSize: 13, color: "rgba(243,236,220,0.72)" }}>
          {profileOf(frag).join(" · ")}
          {occasion && <span style={{ color: "rgba(243,236,220,0.5)" }}> — {occasion}</span>}
        </div>
        <div className="mo-card-price" style={{ fontFamily: MONO, fontSize: 12, color: CREAM, marginTop: 2 }}>From {money(fromPrice(frag))}</div>
        <div className="mo-card-actions" style={{ marginTop: "auto", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <button style={{ ...btnLink, color: locked ? "rgba(243,236,220,0.4)" : GOLD, whiteSpace: "nowrap", fontSize: 9.5 }} onClick={() => (locked ? navigate(paths.about) : onQuickView(frag, defaultFormat))}>
            {locked ? "VIP members only" : <>{action} <Arrow size={10} /></>}
          </button>
          {onToggleDiscovery && !locked && (
            <button
              onClick={() => onToggleDiscovery(frag)}
              aria-pressed={!!inDiscovery}
              style={{ background: "none", border: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap", color: inDiscovery ? GOLD : "rgba(243,236,220,0.6)" }}
            >
              <Icon name="heart" size={13} color={inDiscovery ? GOLD : "rgba(243,236,220,0.6)"} />
              {inDiscovery ? "In your box" : "Add to box"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
