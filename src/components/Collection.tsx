import { useMemo, useState } from "react";
import { type Fragrance, type FormatKey, type Filter, GOLD, CREAM, matches } from "../lib/data";
import { MOODS, type Mood, moodsOf, sku as skuOf, formatStatus } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import FragranceCard from "./FragranceCard";
import { Art, Chip, Container } from "./ui";
import { MONO, SERIF, micro, body } from "./styles";

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

/** Listing page for the whole range, a facet of it, or one format (car / body). */
export default function Collection({ mode, facet, fragrances, vip, discoveryIds, onQuickView, onToggleDiscovery }: CollectionProps) {
  const initialGender: Filter | "unisex" = facet === "him" ? "men" : facet === "her" ? "women" : facet === "unisex" ? "unisex" : "all";
  const initialMood = MOODS.find((m) => m.id.toLowerCase() === facet)?.id ?? null;
  const initialFormat = FORMAT_FACETS.find((x) => x.id === facet)?.id ?? (mode === "car" ? "car" : mode === "body" ? "body" : null);
  const [gender, setGender] = useState<Filter | "unisex">(initialGender);
  const [mood, setMood] = useState<Mood | null>(initialMood);
  const [format, setFormat] = useState<string | null>(initialFormat);

  const list = useMemo(() => {
    let out = fragrances;
    if (gender === "unisex") out = out.filter((f) => f.gender === "unisex");
    else if (gender !== "all") out = out.filter((f) => matches(f, gender));
    if (mood) out = out.filter((f) => moodsOf(f).includes(mood));
    if (format) {
      const key = FORMAT_FACETS.find((x) => x.id === format)?.key;
      if (key) out = out.filter((f) => formatStatus(f, key) !== "hidden");
    }
    return out;
  }, [fragrances, gender, mood, format]);

  const intro = INTRO[mode];
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
        {/* Filters: gender is a filter, not the architecture. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderBottom: "1px solid #1f1f27", paddingBottom: 14 }}>
          <span style={{ ...micro, marginRight: 4 }}>For</span>
          {GENDERS.map((g) => (
            <Chip key={g.id} active={gender === g.id} onClick={() => setGender(g.id)}>{g.label}</Chip>
          ))}
          <span style={{ ...micro, marginLeft: 16, marginRight: 4 }}>Mood</span>
          {MOODS.slice(0, 8).map((m) => (
            <Chip key={m.id} active={mood === m.id} onClick={() => setMood(mood === m.id ? null : m.id)}>{m.id}</Chip>
          ))}
          {mode !== "car" && mode !== "body" && (
            <>
              <span style={{ ...micro, marginLeft: 16, marginRight: 4 }}>Format</span>
              {FORMAT_FACETS.map((x) => (
                <Chip key={x.id} active={format === x.id} onClick={() => setFormat(format === x.id ? null : x.id)}>{x.label}</Chip>
              ))}
            </>
          )}
          <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "rgba(243,236,220,0.5)" }}>{list.length} of {fragrances.length}</span>
        </div>

        {list.length === 0 ? (
          <p style={{ ...body, marginTop: 30 }}>Nothing matches those filters yet. <button style={{ background: "none", border: 0, color: GOLD, cursor: "pointer", padding: 0, font: "inherit" }} onClick={() => { setGender("all"); setMood(null); setFormat(null); }}>Clear filters</button> or <button style={{ background: "none", border: 0, color: GOLD, cursor: "pointer", padding: 0, font: "inherit" }} onClick={() => navigate(paths.find())}>find your scent</button>.</p>
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
              />
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
