import { useEffect, useState } from "react";
import { type Fragrance, type FormatKey, GOLD, CREAM, money } from "../lib/data";
import { GROUPS, type FormatGroup, skusInGroup, sku as skuOf, profileOf, referenceOf, type Sku } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import BottleImage from "./BottleImage";
import { FormatGlyph } from "./ProductGlyphs";
import { Arrow, InspiredBy } from "./ui";
import { MONO, SERIF, btnGold, btnLink, micro } from "./styles";

interface QuickViewProps {
  frag: Fragrance;
  initialFormat?: FormatKey;
  onClose: () => void;
  onAdd: (f: Fragrance, key: FormatKey, qty: number) => void;
}

const ORDER: FormatGroup[] = ["wear", "drive", "live", "ritual"];

/**
 * The format selector — "How would you like it?" — as a slide-in drawer so a
 * customer never walks through five product pages to compare ways in.
 */
export default function QuickView({ frag, initialFormat, onClose, onAdd }: QuickViewProps) {
  const first = initialFormat && skuOf(frag, initialFormat).status !== "hidden" ? initialFormat : "perf50";
  const [key, setKey] = useState<FormatKey>(first);
  const [notified, setNotified] = useState<Set<FormatKey>>(new Set());
  const chosen = skuOf(frag, key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const row = (s: Sku) => {
    const active = s.key === key;
    const soon = s.status === "coming_soon";
    return (
      <button
        key={s.key}
        onClick={() => (soon ? setNotified((n) => new Set(n).add(s.key)) : setKey(s.key))}
        aria-pressed={active}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          width: "100%",
          textAlign: "left",
          background: active ? "rgba(201,169,97,0.1)" : "none",
          border: `1px solid ${active ? GOLD : "#1f1f27"}`,
          padding: "12px 14px",
          cursor: "pointer",
          color: CREAM,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 40, display: "grid", placeItems: "center" }}><FormatGlyph formatKey={s.key} liquid={frag.liquid} height={s.key === "ritual" ? 24 : 40} /></span>
          <span>
          <span style={{ display: "block", fontFamily: SERIF, fontSize: 17 }}>{s.def.name}</span>
          <span style={{ ...micro, fontSize: 8, display: "block", marginTop: 3, color: soon ? GOLD : "rgba(243,236,220,0.5)" }}>
            {soon ? (notified.has(s.key) ? "We'll let you know" : "Coming soon · Notify me") : s.availability}
          </span>
          </span>
        </span>
        <span style={{ fontFamily: MONO, fontSize: 12, whiteSpace: "nowrap", color: soon ? "rgba(243,236,220,0.5)" : CREAM }}>
          {s.compareAt && <s style={{ marginRight: 8, color: "rgba(243,236,220,0.4)" }}>{money(s.compareAt)}</s>}
          {money(s.price)}
        </span>
      </button>
    );
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`${frag.name} — choose a format`} style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }} />
      <aside className="mo-drawer mo-scroll" style={{ position: "relative", width: 460, maxWidth: "100%", height: "100%", overflowY: "auto", background: "#0f0f13", borderLeft: "1px solid #1f1f27", padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-square.jpg" alt="" accent={frag.accent} liquid={frag.liquid} height={72} style={{ width: 60 }} />
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 26, letterSpacing: "0.06em", textTransform: "uppercase", color: CREAM, lineHeight: 1 }}>{frag.name}</div>
              <div style={{ ...micro, marginTop: 6 }}>{profileOf(frag).join(" · ")}</div>
            </div>
          </div>
        </div>
        <div>
          <InspiredBy {...referenceOf(frag)} size="md" />
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "1px solid #1f1f27", color: CREAM, width: 34, height: 34, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 20, color: "rgba(243,236,220,0.85)" }}>How would you like it?</div>

        {ORDER.map((g) => {
          const list = skusInGroup(frag, g);
          if (!list.length) return null;
          return (
            <div key={g} style={{ display: "grid", gap: 8 }}>
              <div style={{ ...micro, color: GOLD, letterSpacing: "0.3em" }}>{GROUPS[g].title}</div>
              {list.map(row)}
            </div>
          );
        })}

        <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid #1f1f27", display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: SERIF, fontSize: 16, color: "rgba(243,236,220,0.85)" }}>{chosen.def.name}</span>
            <span style={{ fontFamily: MONO, fontSize: 15, color: CREAM }}>{money(chosen.price)}</span>
          </div>
          <button className="mo-cta" style={{ ...btnGold, justifyContent: "center", opacity: chosen.buyable ? 1 : 0.5 }} disabled={!chosen.buyable} onClick={() => onAdd(frag, key, 1)}>
            {chosen.buyable ? "Add to bag" : chosen.status === "coming_soon" ? "Coming soon" : "Sold out"} <Arrow />
          </button>
          <button style={{ ...btnLink, justifyContent: "center" }} onClick={() => { onClose(); navigate(paths.product(frag.slug)); }}>
            View the full fragrance <Arrow size={10} />
          </button>
        </div>
      </aside>
    </div>
  );
}
