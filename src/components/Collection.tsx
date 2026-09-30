import { useEffect, useMemo, useState } from "react";
import { type Fragrance, type FormatKey, type Filter, GOLD, CREAM, matches } from "../lib/data";
import { isNew } from "../lib/launch";
import { MOODS, type Mood, moodsOf, sku as skuOf, formatStatus, matchesReference } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import FragranceCard from "./FragranceCard";
import RangeBanners from "./RangeBanners";
import { trackViewItemList } from "../lib/analytics";
import { fromPrice } from "../lib/formats";
import HouseBrowser from "./HouseBrowser";
import { Art, Chip, Container } from "./ui";
import { MONO, SERIF, micro, body } from "./styles";

export type CollectionMode = "shop" | "fragrances" | "car" | "body";

interface CollectionProps {
  mode: CollectionMode;
  facet: string | null;
  fragrances: Fragrance[];
  vip: boolean;
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
}

const GENDERS: { id: Filter | "unisex"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "men", label: "For Him" },
  { id: "women", label: "For Her" },
  { id: "unisex", label: "Unisex" },
];
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

// Landing copy for facets that are a customer occasion rather than a filter.
const FACET_INTRO: Record<string, { eyebrow: string; title: string; copy: string; art?: string; fallback?: string }> = {
  gifts: {
    eyebrow: "Gifts",
    title: "Give a scent.",
    copy: "Not sure of their taste? The Discovery Box lets them try five. Know exactly what they wear? A 50 ml with a few engraved words. Every fragrance below can be either.",
  },
};

// The scent families shown up front; the rest of the moods sit under More filters.
const PRIMARY_MOODS = MOODS.slice(0, 5);

/** Listing page for the whole range, a facet of it, or one format (car / body). */
export default function Collection({ mode, facet, fragrances, vip, onQuickView }: CollectionProps) {
  const initialGender: Filter | "unisex" = facet === "him" ? "men" : facet === "her" ? "women" : facet === "unisex" ? "unisex" : "all";
  const initialMood = MOODS.find((m) => m.id.toLowerCase() === facet)?.id ?? null;
  const initialFormat = FORMAT_FACETS.find((x) => x.id === facet)?.id ?? (mode === "car" ? "car" : mode === "body" ? "body" : null);
  const [gender, setGender] = useState<Filter | "unisex">(initialGender);
  const [mood, setMood] = useState<Mood | null>(initialMood);
  const [format, setFormat] = useState<string | null>(initialFormat);
  const [inspired, setInspired] = useState("");
  const [onlyNew, setOnlyNew] = useState(false);
  // Opens already expanded when a link (/shop/sweet) set a mood that lives under More filters.
  const [moreOpen, setMoreOpen] = useState(() => !!initialMood && !PRIMARY_MOODS.some((m) => m.id === initialMood));
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

  const intro = (facet && FACET_INTRO[facet]) || INTRO[mode];
  const listIds = list.map((f) => f.id).join(",");
  useEffect(() => {
    if (view !== "grid") return;
    trackViewItemList(facet ?? mode, list.slice(0, 20).map((f) => ({ id: f.id, name: f.name, priceCents: fromPrice(f) })));
    // Once per distinct result set, not per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listIds, view]);

  // Every active filter as a removable chip, whether it was set up front or under More filters.
  const applied: { label: string; clear: () => void }[] = [
    ...(gender !== "all" ? [{ label: GENDERS.find((g) => g.id === gender)!.label, clear: () => setGender("all") }] : []),
    ...(mood ? [{ label: mood, clear: () => setMood(null) }] : []),
    ...(format ? [{ label: FORMAT_FACETS.find((x) => x.id === format)?.label ?? format, clear: () => setFormat(null) }] : []),
    ...(onlyNew ? [{ label: "New", clear: () => setOnlyNew(false) }] : []),
    ...(view === "grid" && inspired.trim() ? [{ label: `Inspired by “${inspired.trim()}”`, clear: () => setInspired("") }] : []),
  ];
  const clearAll = () => {
    setGender("all");
    setMood(null);
    setFormat(null);
    setInspired("");
    setOnlyNew(false);
  };
  const defaultFormat: FormatKey | undefined = mode === "car" ? "car" : mode === "body" ? "wash" : FORMAT_FACETS.find((x) => x.id === format)?.key;
  const comingSoonCount = mode === "body" ? list.filter((f) => skuOf(f, "wash").status === "coming_soon").length : 0;

  return (
    <main data-screen-label={intro.title}>
      {intro.art ? (
        <Art src={intro.art} fallback={intro.fallback} alt="" position="right center" style={{ minHeight: 240, borderBottom: "1px solid #1f1f27" }}>
          <Container style={{ position: "relative", padding: "50px 32px" }}>
            <div style={{ ...micro, color: GOLD }}>{intro.eyebrow}</div>
            <h1 style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 48, color: CREAM, lineHeight: 1 }}>{intro.title}</h1>
            <p style={{ ...body, margin: "12px 0 0", maxWidth: 520 }}>{intro.copy}</p>
            {comingSoonCount > 0 && (
              <p style={{ margin: "10px 0 0", ...micro, color: GOLD }}>Body care is launching scent by scent — {comingSoonCount} coming soon. Tap “Notify me” on any fragrance.</p>
            )}
          </Container>
        </Art>
      ) : (
        <Container style={{ padding: "44px 32px 8px" }}>
          <div style={{ ...micro, color: GOLD }}>{intro.eyebrow}</div>
          <h1 style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 48, color: CREAM, lineHeight: 1 }}>{intro.title}</h1>
          <p style={{ ...body, margin: "12px 0 0", maxWidth: 560 }}>{intro.copy}</p>
        </Container>
      )}

      <Container style={{ padding: "18px 32px 60px" }}>
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
        {/* Filters, progressively: who it's for and the scent family up front,
            everything else behind More filters. Applied filters stay visible
            as removable chips, with the result count beside them. */}
        <div className="mo-filters" style={{ borderBottom: "1px solid #1f1f27", paddingBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div className="mo-filter-group" role="group" aria-label="For">
              <span style={{ ...micro, marginRight: 4 }}>For</span>
              {GENDERS.map((g) => (
                <Chip key={g.id} active={gender === g.id} onClick={() => setGender(g.id)}>{g.label}</Chip>
              ))}
            </div>
            <div className="mo-filter-group" role="group" aria-label="Scent family">
              <span style={{ ...micro, marginLeft: 16, marginRight: 4 }}>Scent</span>
              {PRIMARY_MOODS.map((m) => (
                <Chip key={m.id} active={mood === m.id} onClick={() => setMood(mood === m.id ? null : m.id)}>{m.id}</Chip>
              ))}
            </div>
            <button
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              aria-controls="mo-more-filters"
              style={{ marginLeft: 8, background: "none", border: "1px solid rgba(201,169,97,0.45)", color: CREAM, height: 30, padding: "0 12px", cursor: "pointer", fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase" }}
            >
              {moreOpen ? "Fewer filters" : "More filters"}
            </button>
            <span aria-live="polite" style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "rgba(243,236,220,0.6)" }}>
              {list.length} {list.length === 1 ? "scent" : "scents"}
            </span>
          </div>

          {moreOpen && (
            <div id="mo-more-filters" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <div className="mo-filter-group" role="group" aria-label="More scent families">
                <span style={{ ...micro, marginRight: 4 }}>Mood</span>
                {MOODS.slice(PRIMARY_MOODS.length, 8).map((m) => (
                  <Chip key={m.id} active={mood === m.id} onClick={() => setMood(mood === m.id ? null : m.id)}>{m.id}</Chip>
                ))}
              </div>
              {mode !== "car" && mode !== "body" && (
                <div className="mo-filter-group" role="group" aria-label="Format">
                  <span style={{ ...micro, marginLeft: 16, marginRight: 4 }}>Format</span>
                  {FORMAT_FACETS.map((x) => (
                    <Chip key={x.id} active={format === x.id} onClick={() => setFormat(format === x.id ? null : x.id)}>{x.label}</Chip>
                  ))}
                </div>
              )}
              {newCount > 0 && (
                <div className="mo-filter-group" role="group" aria-label="New">
                  <Chip active={onlyNew} tone="gold" onClick={() => setOnlyNew((v) => !v)}>New · {newCount}</Chip>
                </div>
              )}
              {view === "grid" && (
                <div className="mo-filter-group mo-filter-search">
                  <span style={{ ...micro, marginLeft: 16, marginRight: 4 }}>Inspired by</span>
                  <input
                    type="search"
                    value={inspired}
                    onChange={(e) => setInspired(e.target.value)}
                    placeholder="Tom Ford, Black Opium…"
                    aria-label="Search by the fragrance or house it is inspired by"
                    style={{ background: "none", border: "1px solid rgba(201,169,97,0.45)", outline: "none", color: CREAM, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.02em", padding: "7px 10px", width: 190 }}
                  />
                </div>
              )}
            </div>
          )}

          {applied.length > 0 && (
            <div aria-label="Applied filters" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {applied.map((a) => (
                <button key={a.label} onClick={a.clear} aria-label={`Remove filter ${a.label}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(201,169,97,0.12)", border: "1px solid rgba(201,169,97,0.5)", color: CREAM, height: 28, padding: "0 10px", cursor: "pointer", fontSize: 12 }}>
                  {a.label} <span aria-hidden style={{ color: GOLD }}>×</span>
                </button>
              ))}
              <button onClick={clearAll} style={{ background: "none", border: 0, color: GOLD, cursor: "pointer", fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase" }}>Clear all</button>
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
                listName={facet ?? mode}
              />
            ))}
          </div>
        )}
      </Container>
      {mode === "fragrances" && <RangeBanners />}
    </main>
  );
}
