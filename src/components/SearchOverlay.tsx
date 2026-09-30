import { useMemo, useRef, useState } from "react";
import { type Fragrance, GOLD, CREAM, money } from "../lib/data";
import { fromPrice, matchesReference, profileOf, referenceOf } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import { trackSearch, trackSelectItem } from "../lib/analytics";
import BottleImage from "./BottleImage";
import { Arrow, Icon } from "./ui";
import { MONO, SERIF, micro } from "./styles";
import { useDialog } from "./useDialog";

const squash = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ");

/** Our own fragrances whose name, profile or notes contain every word typed. */
function searchCatalogue(fragrances: Fragrance[], query: string): Fragrance[] {
  const words = squash(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return fragrances.filter((f) => {
    const hay = squash([f.name, f.tagline, ...profileOf(f), ...f.top, ...f.heart, ...f.base].join(" "));
    return words.every((w) => hay.includes(w));
  });
}

/**
 * The header's search. It behaves like the catalogue search shoppers expect —
 * our fragrances first — and keeps the house's matcher alongside: "find an
 * equivalent" for a fragrance they already love from another house.
 */
export default function SearchOverlay({ fragrances, onClose }: { fragrances: Fragrance[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  useDialog(ref, true, onClose);

  const ours = useMemo(() => searchCatalogue(fragrances, q).slice(0, 5), [fragrances, q]);
  const equivalents = useMemo(() => (q.trim().length > 1 ? fragrances.filter((f) => matchesReference(f, q)).slice(0, 3) : []), [fragrances, q]);
  const typed = q.trim();

  const open = (f: Fragrance) => {
    trackSearch(typed);
    trackSelectItem({ id: f.id, name: f.name }, "search");
    onClose();
    navigate(paths.product(f.slug));
  };
  const findEquivalent = () => {
    trackSearch(typed);
    onClose();
    navigate(paths.find(typed));
  };

  const row = (f: Fragrance, note: string) => (
    <li key={f.id}>
      <button className="mo-softhover" onClick={() => open(f)} style={{ width: "100%", display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 14, alignItems: "center", background: "none", border: 0, borderBottom: "1px solid #17171d", padding: "10px 4px", cursor: "pointer", textAlign: "left", color: CREAM }}>
        <span style={{ width: 44, height: 54, display: "grid", placeItems: "center", overflow: "hidden" }}>
          <BottleImage imageUrl={f.imageUrl} fallbackSrc="/assets/bottle-square.jpg" alt="" accent={f.accent} liquid={f.liquid} height={54} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: SERIF, fontSize: 19 }}>{f.name}</span>
          <span style={{ display: "block", fontSize: 12, color: "rgba(243,236,220,0.6)" }}>{note}</span>
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: "rgba(243,236,220,0.8)" }}>From {money(fromPrice(f))}</span>
      </button>
    </li>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Search" style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(5,5,7,0.72)" }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="mo-search-panel" style={{ maxWidth: 680, margin: "72px auto 0", background: "#0f0f13", border: "1px solid #1f1f27", boxShadow: "0 30px 60px rgba(0,0,0,0.6)", padding: "18px 22px 20px" }}>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (ours.length) open(ours[0]);
            else if (typed) findEquivalent();
          }}
          style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(201,169,97,0.5)", paddingBottom: 10 }}
        >
          <Icon name="search" size={18} color={GOLD} />
          <input
            data-autofocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search fragrances, notes or a scent you love"
            aria-label="Search"
            style={{ flex: 1, minWidth: 0, background: "none", border: 0, outline: "none", color: CREAM, fontFamily: SERIF, fontSize: 21 }}
          />
          <button type="button" onClick={onClose} aria-label="Close search" style={{ background: "none", border: 0, cursor: "pointer", color: "rgba(243,236,220,0.6)", fontSize: 22, lineHeight: 1 }}>×</button>
        </form>

        {typed ? (
          <>
            <div style={{ ...micro, color: GOLD, margin: "16px 0 4px" }}>Maison Obsidian</div>
            {ours.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{ours.map((f) => row(f, profileOf(f).join(" · ")))}</ul>
            ) : (
              <p style={{ margin: "8px 0", fontSize: 13, color: "rgba(243,236,220,0.6)" }}>None of our fragrances are called that.</p>
            )}

            <div style={{ ...micro, color: GOLD, margin: "18px 0 4px" }}>Find an equivalent</div>
            {equivalents.length > 0 && (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {equivalents.map((f) => {
                  const r = referenceOf(f);
                  return row(f, `Our take on ${[r.brand, r.fragrance].filter(Boolean).join(" ")}`);
                })}
              </ul>
            )}
            <button onClick={findEquivalent} style={{ marginTop: 10, background: "none", border: 0, cursor: "pointer", color: GOLD, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 8, padding: 0 }}>
              Match “{typed}” to our fragrances <Arrow size={10} />
            </button>
          </>
        ) : (
          <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.6, color: "rgba(243,236,220,0.6)" }}>
            Type one of our fragrances or a note like <em>vanilla</em>, or a fragrance you already love from another house and we'll find its closest match.
          </p>
        )}
      </div>
    </div>
  );
}
