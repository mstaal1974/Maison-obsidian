import { useEffect, useMemo, useRef, useState } from "react";
import { type Fragrance, type FormatKey, type Filter, GOLD, CREAM, matches } from "../lib/data";
import { isNew } from "../lib/launch";
import { MOODS, type Mood, moodsOf, sku as skuOf, formatStatus, matchesReference, fromPrice } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import { trackViewItemList } from "../lib/analytics";
import FragranceCard from "./FragranceCard";
import HouseBrowser from "./HouseBrowser";
import { Art, Chip, Container } from "./ui";
import { MONO, SERIF, btnGold, micro, body } from "./styles";
import "../styles/collection.css";

export type CollectionMode = "shop" | "fragrances" | "car" | "body";

interface CollectionProps {
  mode: CollectionMode;
  facet: string | null;
  fragrances: Fragrance[];
  vip: boolean;
  discoveryIds: string[];
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
  onToggleDiscovery: (f: Fragrance) => void;
}

const GENDERS: { id: Filter | "unisex"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "men", label: "For Him" },
  { id: "women", label: "For Her" },
  { id: "unisex", label: "Unisex" },
];
// Scent families lead; the two occasion moods sit behind "More filters".
const FAMILIES = MOODS.slice(0, 8);
const OCCASIONS = MOODS.slice(8);
const FORMAT_FACETS: { id: string; label: string; key: FormatKey }[] = [
  { id: "10ml", label: "10ml Discovery", key: "perf10" },
  { id: "30ml", label: "30ml Everyday", key: "perf30" },
  { id: "50ml", label: "50ml Signature", key: "perf50" },
  { id: "car", label: "Car", key: "car" },
  { id: "body", label: "Body", key: "wash" },
  { id: "sets", label: "Sets", key: "ritual" },
];

const INTRO: Record<CollectionMode, { eyebrow: string; title: string; copy: string; art?: string; fallback?: string }> = {
  shop: { eyebrow: "Shop", title: "Every scent. Every way in.", copy: "Filter by who it's for, the mood you're after, or the format you want it in." },
  fragrances: { eyebrow: "Eau de Parfum · Signature", title: "The fragrances.", copy: "30% extrait, poured in small batches. Meet each in 10 ml, live in it at 30 ml, sign it at 50 ml." },
  car: { eyebrow: "Obsidian Drive", title: "Your fragrance. Your car.", copy: "Every scent in the house, in our handcrafted wooden-cap car diffuser. Same iconic scents — a bolder journey.", art: "/assets/banner-drive.jpg", fallback: "/assets/bottle-portrait.webp" },
  body: { eyebrow: "Obsidian Ritual", title: "Cleanse. Hydrate. Be obsessed.", copy: "Body wash, moisturiser and the Complete Ritual set. Layer the fragrance from morning to night.", art: "/assets/banner-ritual.jpg", fallback: "/assets/bottle-pair.png" },
};

const PHONE = "(max-width: 720px)";

/** Group label in the filter panel. */
const groupLabel = { ...micro, minWidth: 64 } as const;

/** Listing page for the whole range, a facet of it, or one format (car / body). */
export default function Collection({ mode, facet, fragrances, vip, discoveryIds, onQuickView, onToggleDiscovery }: CollectionProps) {
  const initialGender: Filter | "unisex" = facet === "him" ? "men" : facet === "her" ? "women" : facet === "unisex" ? "unisex" : "all";
  const initialMood = MOODS.find((m) => m.id.toLowerCase() === facet)?.id ?? null;
  // Car and body pages are one format; that is the page, not a filter to clear.
  const baseFormat = mode === "car" ? "car" : mode === "body" ? "body" : null;
  const initialFormat = FORMAT_FACETS.find((x) => x.id === facet)?.id ?? baseFormat;
  const [gender, setGender] = useState<Filter | "unisex">(initialGender);
  const [mood, setMood] = useState<Mood | null>(initialMood);
  const [format, setFormat] = useState<string | null>(initialFormat);
  const [inspired, setInspired] = useState("");
  const [onlyNew, setOnlyNew] = useState(false);
  // Less-used filters stay folded unless the URL already picked one of them.
  const [moreOpen, setMoreOpen] = useState(OCCASIONS.some((m) => m.id === initialMood));
  // Phones: the filters open as a bottom sheet from the sticky bar.
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetBtn = useRef<HTMLButtonElement>(null);
  const sheetClose = useRef<HTMLButtonElement>(null);
  // Most shoppers know the original they love, so the full range opens on
  // house → scent; facets, car and body open on the grid.
  const [view, setView] = useState<"house" | "grid">(mode === "fragrances" || (mode === "shop" && !facet) ? "house" : "grid");
  const newCount = useMemo(() => fragrances.filter((f) => isNew(f)).length, [fragrances]);

  const list = useMemo(() => {
    let out = fragrances;
    if (gender === "unisex") out = out.filter((f) => f.gender === "unisex");
    else if (gender !== "all") out = out.filter((f) => matches(f, gender));
    if (mood) out = out.filter((f) => moodsOf(f).includes(mood));
    if (format) {
      const key = FORMAT_FACETS.find((x) => x.id === format)?.key;
      if (key) out = out.filter((f) => formatStatus(f, key) !== "hidden");
    }
    if (view === "grid" && inspired.trim()) out = out.filter((f) => matchesReference(f, inspired));
    if (onlyNew) out = out.filter((f) => isNew(f));
    return out;
  }, [fragrances, gender, mood, format, inspired, onlyNew, view]);

  // view_item_list once per distinct result set; the pause lets a shopper
  // finish typing in "Inspired by" before the list counts as seen.
  const listName = mode === "shop" ? (facet ? `shop_${facet}` : "shop") : mode;
  const listIds = list.map((f) => f.id).join(",");
  useEffect(() => {
    if (!listIds) return;
    const t = window.setTimeout(() => trackViewItemList(listName, list.map((f) => ({ id: f.id, name: f.name, priceCents: fromPrice(f) }))), 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listIds, listName]);

  // The sheet behaves as a dialog: Escape closes it, the page behind stops
  // scrolling, focus goes in and comes back to the Filters button. It closes
  // itself if the window widens past phone size.
  useEffect(() => {
    if (!sheetOpen) return;
    const opener = sheetBtn.current;
    const mq = window.matchMedia(PHONE);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    const onWiden = () => !mq.matches && setSheetOpen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetClose.current?.focus();
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWiden);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWiden);
      opener?.focus();
    };
  }, [sheetOpen]);

  const clearAll = () => {
    setGender("all");
    setMood(null);
    setFormat(baseFormat);
    setInspired("");
    setOnlyNew(false);
  };
  // The selected filters, each removable on its own.
  const active: { key: string; label: string; clear: () => void }[] = [];
  if (mood) active.push({ key: "mood", label: mood, clear: () => setMood(null) });
  if (gender !== "all") active.push({ key: "for", label: GENDERS.find((g) => g.id === gender)?.label ?? gender, clear: () => setGender("all") });
  if (format && format !== baseFormat) active.push({ key: "format", label: FORMAT_FACETS.find((x) => x.id === format)?.label ?? format, clear: () => setFormat(baseFormat) });
  if (onlyNew) active.push({ key: "new", label: "New", clear: () => setOnlyNew(false) });
  if (view === "grid" && inspired.trim()) active.push({ key: "inspired", label: `“${inspired.trim()}”`, clear: () => setInspired("") });
  const countText = `${list.length} ${list.length === 1 ? "scent" : "scents"}`;

  const intro = INTRO[mode];
  const defaultFormat: FormatKey | undefined = mode === "car" ? "car" : mode === "body" ? "wash" : FORMAT_FACETS.find((x) => x.id === format)?.key;
  const comingSoonCount = mode === "body" ? list.filter((f) => skuOf(f, "wash").status === "coming_soon").length : 0;

  return (
    <main data-screen-label={intro.title}>
      {intro.art ? (
        <Art src={intro.art} fallback={intro.fallback} alt="" position="right center" style={{ minHeight: 240, borderBottom: "1px solid #1f1f27" }}>
          <Container className="mo-coll" style={{ position: "relative", padding: "50px 32px" }}>
            <div style={{ ...micro, color: GOLD }}>{intro.eyebrow}</div>
            <h1 style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 48, color: CREAM, lineHeight: 1 }}>{intro.title}</h1>
            <p style={{ ...body, margin: "12px 0 0", maxWidth: 520 }}>{intro.copy}</p>
            {comingSoonCount > 0 && (
              <p style={{ margin: "10px 0 0", ...micro, color: GOLD }}>Body care is launching scent by scent — {comingSoonCount} coming soon. Tap “Notify me” on any fragrance.</p>
            )}
          </Container>
        </Art>
      ) : (
        <Container className="mo-coll" style={{ padding: "44px 32px 8px" }}>
          <div style={{ ...micro, color: GOLD }}>{intro.eyebrow}</div>
          <h1 style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 48, color: CREAM, lineHeight: 1 }}>{intro.title}</h1>
          <p style={{ ...body, margin: "12px 0 0", maxWidth: 560 }}>{intro.copy}</p>
        </Container>
      )}

      <Container className="mo-coll" style={{ padding: "18px 32px 60px" }}>
        {mode !== "car" && mode !== "body" && (
          <div role="tablist" aria-label="Browse" style={{ display: "flex", gap: 0, marginBottom: 14 }}>
            {([
              ["house", "By house"],
              ["grid", "All scents"],
            ] as const).map(([id, text]) => (
              <button
                key={id}
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                style={{
                  background: view === id ? GOLD : "none",
                  color: view === id ? "#0b0b0d" : CREAM,
                  border: `1px solid ${view === id ? GOLD : "rgba(201,169,97,0.45)"}`,
                  height: 38,
                  padding: "0 20px",
                  cursor: "pointer",
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  fontWeight: view === id ? 700 : 400,
                }}
              >
                {text}
              </button>
            ))}
          </div>
        )}

        {/* Filters: gender is a filter, not the architecture. The common ones
            show up front; occasion and New fold under "More filters". On
            phones the panel is a bottom sheet opened from the sticky bar. */}
        {sheetOpen && <div className="mo-coll-scrim" aria-hidden="true" onClick={() => setSheetOpen(false)} />}
        <div
          id="mo-coll-filters"
          className="mo-coll-panel"
          data-open={sheetOpen ? "true" : undefined}
          role={sheetOpen ? "dialog" : "group"}
          aria-modal={sheetOpen ? true : undefined}
          aria-label="Filters"
        >
          <div className="mo-coll-sheet-head">
            <span style={{ fontFamily: SERIF, fontSize: 24, color: CREAM }}>Filters</span>
            <button ref={sheetClose} type="button" onClick={() => setSheetOpen(false)} style={{ ...micro, color: GOLD, background: "none", border: 0, cursor: "pointer", padding: "0 4px", minHeight: 44 }}>
              Close
            </button>
          </div>
          <div className="mo-coll-group mo-coll-group-wide" role="group" aria-label="Scent family">
            <span style={groupLabel}>Scent</span>
            <div className="mo-coll-chips">
              {FAMILIES.map((m) => (
                <Chip key={m.id} active={mood === m.id} onClick={() => setMood(mood === m.id ? null : m.id)}>{m.id}</Chip>
              ))}
            </div>
          </div>
          <div className="mo-coll-group" role="group" aria-label="For">
            <span style={groupLabel}>For</span>
            <div className="mo-coll-chips">
              {GENDERS.map((g) => (
                <Chip key={g.id} active={gender === g.id} onClick={() => setGender(g.id)}>{g.label}</Chip>
              ))}
            </div>
          </div>
          {mode !== "car" && mode !== "body" && (
            <div className="mo-coll-group" role="group" aria-label="Format">
              <span style={groupLabel}>Format</span>
              <div className="mo-coll-chips">
                {FORMAT_FACETS.map((x) => (
                  <Chip key={x.id} active={format === x.id} onClick={() => setFormat(format === x.id ? null : x.id)}>{x.label}</Chip>
                ))}
              </div>
            </div>
          )}
          {view === "grid" && (
            <div className="mo-coll-group">
              <label htmlFor="mo-coll-inspired" style={groupLabel}>Inspired by</label>
              <input
                id="mo-coll-inspired"
                className="mo-coll-search"
                type="search"
                value={inspired}
                onChange={(e) => setInspired(e.target.value)}
                placeholder="Tom Ford, Black Opium…"
                style={{ background: "none", border: "1px solid rgba(201,169,97,0.45)", outline: "none", color: CREAM, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.02em", padding: "7px 10px", width: 210 }}
              />
            </div>
          )}
          <div className="mo-coll-group mo-coll-group-wide">
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-controls="mo-coll-more"
              onClick={() => setMoreOpen((v) => !v)}
              style={{ ...micro, color: GOLD, background: "none", border: 0, cursor: "pointer", padding: 0, minHeight: 32 }}
            >
              {moreOpen ? "Fewer filters −" : "More filters +"}
            </button>
          </div>
          {moreOpen && (
            <div id="mo-coll-more" className="mo-coll-more">
              <div className="mo-coll-group" role="group" aria-label="Occasion">
                <span style={groupLabel}>Occasion</span>
                <div className="mo-coll-chips">
                  {OCCASIONS.map((m) => (
                    <Chip key={m.id} active={mood === m.id} onClick={() => setMood(mood === m.id ? null : m.id)}>{m.id}</Chip>
                  ))}
                </div>
              </div>
              {newCount > 0 && (
                <div className="mo-coll-group" role="group" aria-label="New">
                  <span style={groupLabel}>Launch</span>
                  <div className="mo-coll-chips">
                    <Chip active={onlyNew} tone="gold" onClick={() => setOnlyNew((v) => !v)}>New · {newCount}</Chip>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="mo-coll-sheet-foot">
            <button type="button" className="mo-cta" onClick={() => setSheetOpen(false)} style={{ ...btnGold, width: "100%", justifyContent: "center" }}>
              Show {countText}
            </button>
          </div>
        </div>

        {/* Selected filters and the live count. Sticky under the header on phones. */}
        <div className="mo-coll-bar">
          <button
            ref={sheetBtn}
            type="button"
            className="mo-coll-open"
            aria-expanded={sheetOpen}
            aria-controls="mo-coll-filters"
            onClick={() => setSheetOpen(true)}
            style={{ ...micro, color: CREAM, background: "none", border: "1px solid rgba(201,169,97,0.55)", cursor: "pointer", height: 36, padding: "0 14px" }}
          >
            Filters{active.length ? ` · ${active.length}` : ""}
          </button>
          <span className="mo-coll-count" aria-live="polite" style={{ fontFamily: MONO, fontSize: 10.5, color: "rgba(243,236,220,0.6)" }}>
            {countText}
          </span>
          {active.length > 0 && (
            <div className="mo-coll-active" role="group" aria-label="Selected filters">
              {active.map((a) => (
                <Chip key={a.key} active onClick={a.clear} style={{ gap: 6 }}>
                  <span aria-hidden="true">{a.label} ×</span>
                  <span className="mo-coll-sr">Remove filter: {a.label}</span>
                </Chip>
              ))}
              <button type="button" onClick={clearAll} style={{ ...micro, color: GOLD, background: "none", border: 0, cursor: "pointer", padding: "0 4px", whiteSpace: "nowrap" }}>
                Clear all
              </button>
            </div>
          )}
        </div>

        {list.length === 0 ? (
          <p style={{ ...body, marginTop: 30 }}>Nothing matches those filters yet. <button style={{ background: "none", border: 0, color: GOLD, cursor: "pointer", padding: 0, font: "inherit" }} onClick={clearAll}>Clear filters</button> or <button style={{ background: "none", border: 0, color: GOLD, cursor: "pointer", padding: 0, font: "inherit" }} onClick={() => navigate(paths.find())}>find your scent</button>.</p>
        ) : view === "house" ? (
          <div style={{ marginTop: 18 }}>
            <HouseBrowser fragrances={list} vip={vip} onQuickView={onQuickView} />
          </div>
        ) : (
          <div className="mo-vault-grid" style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {list.map((f) => (
              <FragranceCard
                key={f.id}
                frag={f}
                vip={vip}
                onQuickView={onQuickView}
                defaultFormat={defaultFormat}
                inDiscovery={discoveryIds.includes(f.id)}
                onToggleDiscovery={onToggleDiscovery}
                listName={listName}
              />
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
