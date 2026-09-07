import { type FormEvent, useMemo, useState } from "react";
import { bottleImage } from "../lib/images";
import { type Fragrance, GOLD, CREAM } from "../lib/data";
import { findMatches, MOODS, fromLabel, profileOf, availableIn, referenceOf } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import { Arrow, Container, Icon, Chip, InspiredBy } from "./ui";
import { MONO, SERIF, btnGold, btnLink, micro } from "./styles";
import BottleImage from "./BottleImage";

interface FindYourScentProps {
  fragrances: Fragrance[];
  mode?: "section" | "page";
  initialQuery?: string;
  onQuickView?: (f: Fragrance) => void;
}

/**
 * "Tell us a scent you love." Matches a fragrance or brand the customer already
 * wears against the house's inspiration library and suggests its Obsidian.
 * Renders inline on the homepage (mode="section") and as the full
 * #/find page (mode="page").
 */
export default function FindYourScent({ fragrances, mode = "section", initialQuery = "", onQuickView }: FindYourScentProps) {
  const [q, setQ] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const matches = useMemo(() => (submitted.trim() ? findMatches(submitted, fragrances, mode === "page" ? 4 : 3) : []), [submitted, fragrances, mode]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(q);
    if (mode === "section" && q.trim()) navigate(paths.find(q), false);
  };

  const profiles = MOODS.filter((m) => ["Woody", "Fresh", "Spicy", "Floral"].includes(m.id));

  const bar = (
    <form onSubmit={submit} style={{ display: "flex", alignItems: "stretch", border: "1px solid rgba(201,169,97,0.45)", height: 50, flex: 1, minWidth: 320 }}>
      <span style={{ display: "grid", placeItems: "center", padding: "0 14px 0 16px" }}>
        <Icon name="search" size={17} color={CREAM} />
      </span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. Tom Ford Oud Wood, Le Labo Santal 33, Bleu de Chanel…"
        aria-label="Fragrance or brand you love"
        style={{ flex: 1, background: "none", border: 0, outline: "none", color: CREAM, fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.02em" }}
      />
      <button type="submit" className="mo-cta" style={{ ...btnGold, height: "100%", padding: "0 26px" }}>
        Find my match <Arrow />
      </button>
    </form>
  );

  const results = matches.length > 0 && (
    <div style={{ marginTop: mode === "page" ? 36 : 22, display: "grid", gap: 12 }}>
      <div style={{ ...micro, color: GOLD }}>Your Maison Obsidian match{matches.length > 1 ? "es" : ""}</div>
      <div style={{ display: "grid", gridTemplateColumns: mode === "page" ? "repeat(auto-fill, minmax(300px, 1fr))" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {matches.map((m, i) => (
          <article key={m.frag.id} style={{ border: `1px solid ${i === 0 ? "rgba(201,169,97,0.7)" : "#1f1f27"}`, background: "#101015", display: "grid", gridTemplateColumns: "96px 1fr", gap: 16, padding: 14 }}>
            <BottleImage imageUrl={bottleImage(m.frag)} fallbackSrc="/assets/bottle-square.jpg" alt={`${m.frag.name} bottle`} accent={m.frag.accent} liquid={m.frag.liquid} height={116} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontFamily: SERIF, fontSize: 22, color: CREAM, lineHeight: 1.05 }}>{m.frag.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: GOLD, whiteSpace: "nowrap" }}>{m.percent}% match</div>
              </div>
              <InspiredBy {...referenceOf(m.frag)} size="md" />
              <div style={{ ...micro, color: "rgba(243,236,220,0.7)" }}>{profileOf(m.frag).join(" · ")}</div>
              <div style={{ fontSize: 12, color: "rgba(243,236,220,0.55)", lineHeight: 1.5 }}>{m.reason}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                {availableIn(m.frag).map((a) => (
                  <Chip key={a.group} tone={a.status === "live" ? "gold" : "cream"}>{a.label}{a.status === "coming_soon" ? " · soon" : ""}</Chip>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: CREAM }}>{fromLabel(m.frag)}</span>
                <span style={{ display: "flex", gap: 14 }}>
                  {onQuickView && (
                    <button style={btnLink} onClick={() => onQuickView(m.frag)}>Choose format</button>
                  )}
                  <button style={btnLink} onClick={() => navigate(paths.product(m.frag.slug))}>Explore <Arrow size={10} /></button>
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );

  const noResults = submitted.trim() && !matches.length && (
    <p style={{ marginTop: 18, fontSize: 13, color: "rgba(243,236,220,0.6)" }}>
      Nothing in the house matches “{submitted}” yet. Our concierge can search the 3,000+ fragrance library — or browse by mood below.
    </p>
  );

  if (mode === "page") {
    return (
      <main data-screen-label="Find your scent" style={{ minHeight: "60vh" }}>
        <Container style={{ padding: "54px 32px 80px" }}>
          <div style={{ ...micro, color: GOLD }}>Find your Obsidian</div>
          <h1 style={{ margin: "12px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 52, color: CREAM, lineHeight: 1 }}>Tell us something you already love.</h1>
          <p style={{ margin: "14px 0 30px", maxWidth: 560, fontSize: 14, lineHeight: 1.7, color: "rgba(243,236,220,0.62)" }}>
            Search a fragrance or brand you wear — we'll show the Maison Obsidian scent built on the same profile, and every way you can take it with you.
          </p>
          {bar}
          {results}
          {noResults}
          <div style={{ marginTop: 44, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <span style={micro}>Or explore our scent profiles</span>
            {MOODS.map((m) => (
              <Chip key={m.id} onClick={() => navigate(paths.shop(m.id.toLowerCase()))}>{m.id}</Chip>
            ))}
          </div>
        </Container>
      </main>
    );
  }

  return (
    <section aria-label="Find your fragrance" style={{ borderBottom: "1px solid #1f1f27", background: "linear-gradient(180deg, #0d0d11, #0b0b0d)" }}>
      <Container style={{ padding: "26px 32px 26px" }}>
        <div className="mo-find-grid" style={{ display: "grid", gridTemplateColumns: "300px 1fr auto", alignItems: "center", gap: 28 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 30, color: CREAM, lineHeight: 1.05 }}>Find your fragrance</h2>
            <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "rgba(243,236,220,0.6)" }}>Tell us a scent you love, and we'll suggest your Maison Obsidian match.</p>
          </div>
          {bar}
          <div style={{ display: "flex", alignItems: "center", gap: 18, paddingLeft: 26, borderLeft: "1px solid #1f1f27" }}>
            <span style={{ ...micro, lineHeight: 1.6 }}>Or explore<br />our scent profiles</span>
            <span style={{ display: "flex", gap: 8 }}>
              {profiles.map((m) => (
                <button
                  key={m.id}
                  title={`${m.id} — ${m.hint}`}
                  aria-label={`Shop ${m.id}`}
                  onClick={() => navigate(paths.shop(m.id.toLowerCase()))}
                  style={{ width: 42, height: 42, borderRadius: "50%", border: "2px solid rgba(201,169,97,0.55)", background: `radial-gradient(circle at 35% 35%, ${m.swatch}ee, #0b0b0d)`, cursor: "pointer" }}
                />
              ))}
            </span>
            <button aria-label="All scent profiles" onClick={() => navigate(paths.fragrances)} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(201,169,97,0.7)", background: "none", color: GOLD, display: "grid", placeItems: "center", cursor: "pointer" }}>
              <Arrow size={10} />
            </button>
          </div>
        </div>
        {results}
        {noResults}
      </Container>
    </section>
  );
}
