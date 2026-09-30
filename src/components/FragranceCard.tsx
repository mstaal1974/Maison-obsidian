import { type Fragrance, type FormatKey, GOLD, CREAM, money } from "../lib/data";
import { profileOf, fromPrice, referenceOf } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import { trackSelectItem } from "../lib/analytics";
import { isNew } from "../lib/launch";
import BottleImage from "./BottleImage";
import { Arrow, Icon, InspiredBy } from "./ui";
import { MONO, SERIF, micro } from "./styles";

interface FragranceCardProps {
  frag: Fragrance;
  vip: boolean;
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
  /** Discovery box: present when the card can add a 10 ml to the box. */
  inDiscovery?: boolean;
  onToggleDiscovery?: (f: Fragrance) => void;
  /** Format the quick view opens on from "Choose size" (car / body pages). */
  defaultFormat?: FormatKey;
  /** GA4 item_list_name for select_item, e.g. "shop_woody". */
  listName?: string;
}

/**
 * Collection tile, kept to what a shopper decides on: photo, name, the
 * "Inspired by" band (they search by the fragrance they know), a three-word
 * profile, the entry price and one action. Sizes, notes and other formats
 * live in quick view and on the product page.
 */
export default function FragranceCard({ frag, vip, onQuickView, inDiscovery, onToggleDiscovery, defaultFormat, listName }: FragranceCardProps) {
  const locked = !!frag.vipOnly && !vip;
  // One badge at most: VIP matters more (it gates the purchase) than New.
  const badge = frag.vipOnly ? "VIP" : isNew(frag) ? "New" : null;
  // Real links, so crawlers can follow the collection to every product page;
  // interceptLinks() (lib/route) keeps the click in the app.
  const href = paths.product(frag.slug);
  const select = () => trackSelectItem({ id: frag.id, name: frag.name }, listName);
  return (
    <article className="mo-card" style={{ border: "1px solid #1f1f27", background: "#101015", display: "flex", flexDirection: "column" }}>
      <a className="mo-card-photo" href={href} onClick={select} tabIndex={-1} aria-hidden="true" style={{ position: "relative", display: "block" }}>
        <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-portrait.webp" alt={`${frag.name} bottle`} accent={frag.accent} liquid={frag.liquid} height={300} />
        {badge === "New" && (
          <span style={{ position: "absolute", top: 12, left: 12, ...micro, color: "#0b0b0d", background: GOLD, padding: "4px 8px", fontWeight: 600 }}>New</span>
        )}
        {badge === "VIP" && (
          <span style={{ position: "absolute", top: 12, left: 12, ...micro, color: GOLD, border: "1px solid rgba(201,169,97,0.5)", background: "rgba(11,11,13,0.8)", padding: "4px 8px" }}>VIP</span>
        )}
      </a>
      <div className="mo-card-body" style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <a className="mo-card-name" href={href} onClick={select} style={{ display: "block", textDecoration: "none", fontFamily: SERIF, fontSize: 22, letterSpacing: "0.06em", textTransform: "uppercase", color: CREAM, lineHeight: 1.05 }}>
          {frag.name}
        </a>
        <InspiredBy {...referenceOf(frag)} size="sm" />
        <div style={{ ...micro, color: "rgba(243,236,220,0.75)", fontSize: 8.5 }}>{profileOf(frag).join(" · ")}</div>
        <div className="mo-card-price" style={{ fontFamily: MONO, fontSize: 12, color: CREAM }}>From {money(fromPrice(frag))}</div>
        <div className="mo-card-actions" style={{ marginTop: "auto", paddingTop: 6, display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <button
            className="mo-card-choose"
            onClick={() => (locked ? navigate(paths.about) : onQuickView(frag, defaultFormat))}
            aria-label={locked ? undefined : `Choose size: ${frag.name}`}
            style={{
              alignSelf: "stretch",
              background: "none",
              border: `1px solid ${locked ? "rgba(243,236,220,0.2)" : "rgba(201,169,97,0.6)"}`,
              color: locked ? "rgba(243,236,220,0.45)" : GOLD,
              cursor: "pointer",
              height: 38,
              padding: "0 14px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontFamily: MONO,
              fontSize: 9.5,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {locked ? "VIP members only" : <>Choose size <Arrow size={10} /></>}
          </button>
          {onToggleDiscovery && !locked && (
            // Quiet secondary control: a 10 ml of this scent in the Discovery Box.
            <button
              className="mo-card-discovery"
              onClick={() => onToggleDiscovery(frag)}
              aria-pressed={!!inDiscovery}
              style={{ alignSelf: "flex-start", background: "none", border: 0, padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap", color: inDiscovery ? GOLD : "rgba(243,236,220,0.5)" }}
            >
              <Icon name="heart" size={12} color={inDiscovery ? GOLD : "rgba(243,236,220,0.5)"} />
              {inDiscovery ? "In your Discovery Box" : "Add to Discovery Box"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
