import { useEffect, useMemo, useRef, useState } from "react";
import { type Fragrance, type FormatKey, GOLD, CREAM, money } from "../lib/data";
import { fromPrice, profileOf } from "../lib/formats";
import { housesOf, searchHouses } from "../lib/houses";
import { isNew } from "../lib/launch";
import { navigate, paths } from "../lib/route";
import BottleImage from "./BottleImage";
import { Arrow, Container } from "./ui";
import { MONO, SERIF, body, btnGhost, btnGold, btnLink, micro } from "./styles";

interface HouseBrowserProps {
  fragrances: Fragrance[];
  vip: boolean;
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
  /** "home": its own titled section. "page": sits inside the collection. */
  variant?: "home" | "page";
}

/**
 * Shop by house: pick the house you know, then the original scent, and meet
 * its Obsidian. Hovering (or focusing) a scent previews the bottle; clicking
 * opens the fragrance. The search box narrows both houses and scents.
 */
export default function HouseBrowser({ fragrances, vip, onQuickView, variant = "page" }: HouseBrowserProps) {
  const all = useMemo(() => housesOf(fragrances), [fragrances]);
  const [query, setQuery] = useState("");
  const houses = useMemo(() => searchHouses(all, query), [all, query]);
  // Start on the house with the most scents: the richest first impression.
  const [houseKey, setHouseKey] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const fallbackKey = useMemo(() => [...all].sort((a, b) => b.scents.length - a.scents.length)[0]?.key, [all]);
  const house = houses.find((h) => h.key === houseKey) ?? houses.find((h) => h.key === fallbackKey) ?? houses[0] ?? null;
  const active = house?.scents.find((s) => s.frag.id === activeId) ?? house?.scents[0] ?? null;

  // Keep the chosen house in view inside its own list (a vertical column on
  // desktop, a swipeable row on phones) without scrolling the page.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !el) return;
    // Offsets are relative to the rail (the positioned parent), so subtract the list's own.
    const left = el.offsetLeft - list.offsetLeft;
    const top = el.offsetTop - list.offsetTop;
    if (list.scrollWidth > list.clientWidth) list.scrollLeft = left - 14;
    else if (top < list.scrollTop || top + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top - 6;
  }, [house?.key]);

  const pickHouse = (key: string) => {
    setHouseKey(key);
    setActiveId(null);
  };

  const content = (
    <div className="mo-house-grid" style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr) 280px", border: "1px solid #1f1f27", background: "#0e0e12" }}>
      {/* ── 1. Houses ── */}
      <div className="mo-house-rail" style={{ position: "relative", borderRight: "1px solid #1f1f27", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: 14, borderBottom: "1px solid #1f1f27" }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a house or scent"
            aria-label="Search by the house or fragrance it is inspired by"
            style={{ width: "100%", boxSizing: "border-box", background: "none", border: "1px solid rgba(201,169,97,0.45)", outline: "none", color: CREAM, fontFamily: MONO, fontSize: 11, padding: "9px 10px" }}
          />
        </div>
        <div ref={listRef} className="mo-house-list" role="listbox" aria-label="Houses" style={{ overflowY: "auto", maxHeight: 460, padding: "6px 0" }}>
          {houses.map((h) => {
            const on = h.key === house?.key;
            return (
              <button
                key={h.key}
                role="option"
                aria-selected={on}
                className="mo-house-item"
                onClick={() => pickHouse(h.key)}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  background: on ? "rgba(201,169,97,0.12)" : "none",
                  border: 0,
                  borderLeft: `3px solid ${on ? GOLD : "transparent"}`,
                  padding: "9px 14px 9px 13px",
                  cursor: "pointer",
                  fontFamily: SERIF,
                  fontSize: 18,
                  color: on ? GOLD : CREAM,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: on ? GOLD : "rgba(243,236,220,0.4)" }}>{h.scents.length}</span>
              </button>
            );
          })}
          {houses.length === 0 && <p style={{ ...body, fontSize: 12.5, padding: "8px 14px", margin: 0 }}>No house or scent matches “{query}”.</p>}
        </div>
      </div>

      {/* ── 2. The house's scents ── */}
      <div style={{ padding: "22px 24px", minWidth: 0 }}>
        {house && (
          <>
            <div style={{ ...micro, color: GOLD }}>Inspired by</div>
            <div style={{ fontFamily: SERIF, fontSize: 34, color: CREAM, lineHeight: 1.05, marginTop: 6 }}>{house.name}</div>
            <div style={{ ...micro, marginTop: 8 }}>
              {house.scents.length} {house.scents.length === 1 ? "scent" : "scents"} · pick the one you know
            </div>
            <ul style={{ listStyle: "none", margin: "18px 0 0", padding: 0, borderTop: "1px solid #1f1f27" }}>
              {house.scents.map((s) => {
                const on = s.frag.id === active?.frag.id;
                return (
                  <li key={s.frag.id} style={{ borderBottom: "1px solid #1f1f27" }}>
                    <button
                      className="mo-house-scent"
                      onMouseEnter={() => setActiveId(s.frag.id)}
                      onFocus={() => setActiveId(s.frag.id)}
                      onClick={() => navigate(paths.product(s.frag.slug))}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "14px minmax(0, 1fr) auto",
                        alignItems: "center",
                        gap: 14,
                        width: "100%",
                        textAlign: "left",
                        background: on ? "rgba(201,169,97,0.07)" : "none",
                        border: 0,
                        padding: "13px 8px",
                        cursor: "pointer",
                      }}
                    >
                      <span aria-hidden style={{ width: 14, height: 14, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${s.frag.accent}, ${s.frag.liquid})` }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontFamily: SERIF, fontStyle: "italic", fontSize: 20, color: on ? "#f1dfae" : CREAM, lineHeight: 1.15 }}>
                          {s.original || s.frag.name}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, ...micro, fontSize: 8.5, color: on ? GOLD : "rgba(243,236,220,0.6)" }}>
                          <Arrow size={9} /> {s.frag.name}
                          {isNew(s.frag) && <span style={{ color: "#0b0b0d", background: GOLD, padding: "2px 6px", fontWeight: 600 }}>New</span>}
                        </span>
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: "rgba(243,236,220,0.6)", whiteSpace: "nowrap" }}>From {money(fromPrice(s.frag))}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* ── 3. Preview of the scent under the pointer ── */}
      <div className="mo-house-preview" style={{ borderLeft: "1px solid #1f1f27", display: "flex", flexDirection: "column" }}>
        {active && (
          <>
            <BottleImage
              key={active.frag.id}
              imageUrl={active.frag.imageUrl}
              fallbackSrc="/assets/bottle-portrait.webp"
              alt={`${active.frag.name} bottle`}
              accent={active.frag.accent}
              liquid={active.frag.liquid}
              height={250}
              style={{ animation: "moFade 0.25s ease" }}
            />
            <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <div style={{ fontFamily: SERIF, fontSize: 22, letterSpacing: "0.06em", textTransform: "uppercase", color: CREAM, lineHeight: 1.05 }}>{active.frag.name}</div>
              <div style={{ ...micro, fontSize: 8.5, color: "rgba(243,236,220,0.75)" }}>{profileOf(active.frag).join(" · ")}</div>
              <div style={{ fontSize: 12.5, color: "rgba(243,236,220,0.55)" }}>
                {[active.frag.top[0], active.frag.heart[0], active.frag.base[0]].filter(Boolean).join(" · ")}
              </div>
              <div style={{ marginTop: "auto", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {active.frag.vipOnly && !vip ? (
                  <button style={{ ...btnGhost, height: 40, justifyContent: "center" }} onClick={() => navigate(paths.about)}>VIP members only</button>
                ) : (
                  <button style={{ ...btnGold, height: 40, justifyContent: "center" }} onClick={() => onQuickView(active.frag)}>
                    Choose options <Arrow size={10} />
                  </button>
                )}
                <button style={{ ...btnLink, justifyContent: "center", fontSize: 9 }} onClick={() => navigate(paths.product(active.frag.slug))}>
                  View fragrance <Arrow size={10} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (variant === "page") return content;

  return (
    <section aria-label="Shop by house" style={{ borderBottom: "1px solid #1f1f27" }}>
      <Container style={{ padding: "34px 32px 34px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <div style={{ ...micro, color: GOLD }}>Shop by house</div>
            <h2 style={{ margin: "8px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 34, color: CREAM, lineHeight: 1.05 }}>
              Know the original? <span style={{ fontStyle: "italic", color: GOLD }}>Start there.</span>
            </h2>
            <p style={{ ...body, margin: "8px 0 0", maxWidth: 560 }}>Choose the house, then the scent you love — we'll show you its Obsidian.</p>
          </div>
          <button style={{ ...btnLink, marginLeft: "auto", fontFamily: MONO }} onClick={() => navigate(paths.fragrances)}>
            All {all.length} houses <Arrow size={10} />
          </button>
        </div>
        {content}
      </Container>
    </section>
  );
}
