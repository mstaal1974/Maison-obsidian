import { useMemo } from "react";
import { type Fragrance, type FormatKey, CREAM, GOLD } from "../lib/data";
import { profileOf, referenceOf, relatedTo } from "../lib/formats";
import { launchLabel } from "../lib/launch";
import { navigate, paths } from "../lib/route";
import { usePageMeta } from "../lib/seo";
import BottleImage from "./BottleImage";
import FragranceCard from "./FragranceCard";
import NotifyMe from "./NotifyMe";
import { bottleBackdrop } from "./adminStyles";
import { Arrow, Container, InspiredBy, SideCaption } from "./ui";
import { MONO, SERIF, btnLink, micro } from "./styles";

interface Props {
  frag: Fragrance;
  /** The launched catalogue, for "Meanwhile, try". */
  fragrances: Fragrance[];
  vip: boolean;
  userEmail?: string | null;
  onQuickView: (f: Fragrance, format?: FormatKey) => void;
}

/**
 * A fragrance before its launch date: the story, the notes and what it's
 * inspired by, with a sign-up for one email on the day. Nothing to buy yet.
 */
export default function ComingSoon({ frag, fragrances, vip, userEmail, onQuickView }: Props) {
  const date = launchLabel(frag);
  const profile = profileOf(frag);
  const related = useMemo(() => relatedTo(frag, fragrances, 4), [frag, fragrances]);
  usePageMeta({
    title: `${frag.name}, coming ${date} | Maison Obsidian`,
    description: `${frag.name} is poured on ${date}. ${frag.tagline ?? ""} Join the list to hear the day it arrives.`.replace(/\s+/g, " ").trim(),
    path: paths.product(frag.slug),
    image: frag.imageUrl,
  });

  return (
    <main data-screen-label="Coming soon">
      <div className="mo-pdp-grid" style={{ display: "grid", gridTemplateColumns: "0.72fr 1.28fr", borderBottom: "1px solid #1f1f27" }}>
        <div className="mo-pdp-image" style={{ borderRight: "1px solid #1f1f27", padding: "18px 24px 22px 32px" }}>
          <div style={{ position: "relative", background: bottleBackdrop(frag.accent, frag.liquid), border: "1px solid #1f1f27" }}>
            <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-pdp.jpg" alt={`${frag.name} bottle`} accent={frag.accent} liquid={frag.liquid} height="var(--pdp-image-h, 548px)" objectPosition="center 45%" />
            <SideCaption overlay lines={[...profile, "—", "Coming", date]} style={{ position: "absolute", left: 18, top: 20, background: "rgba(11,11,13,0.55)", padding: "10px 12px", backdropFilter: "blur(2px)" }} />
          </div>
        </div>

        <div className="mo-pdp-details" style={{ padding: "18px 32px 30px 30px" }}>
          <nav aria-label="Breadcrumb" style={{ ...micro, fontSize: 8.5, display: "flex", gap: 6 }}>
            <button style={{ ...btnLink, color: "rgba(243,236,220,0.5)", fontSize: 8.5 }} onClick={() => navigate(paths.home)}>Home</button> /
            <button style={{ ...btnLink, color: "rgba(243,236,220,0.5)", fontSize: 8.5 }} onClick={() => navigate(paths.newArrivals)}>New arrivals</button> /
            <span style={{ color: "rgba(243,236,220,0.8)" }}>{frag.name}</span>
          </nav>
          <h1 className="mo-pdp-title" style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: 54, lineHeight: 1, color: CREAM }}>{frag.name}</h1>
          <div style={{ ...micro, color: GOLD, marginTop: 10, letterSpacing: "0.34em", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ color: "#0b0b0d", background: GOLD, padding: "3px 8px", letterSpacing: "0.2em", fontWeight: 600 }}>Coming {date}</span>
            <span>{profile.join(" · ")}</span>
          </div>
          <div style={{ marginTop: 14 }}><InspiredBy {...referenceOf(frag)} size="lg" /></div>
          <p style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.45, color: "rgba(243,236,220,0.78)", maxWidth: 620 }}>{frag.story}</p>

          <div style={{ marginTop: 28, borderTop: "1px solid #1f1f27", paddingTop: 20, maxWidth: 560 }}>
            <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 26, color: CREAM }}>Be first to know</h2>
            <p style={{ margin: "6px 0 14px", fontSize: 14, lineHeight: 1.6, color: "rgba(243,236,220,0.65)" }}>
              The first batch is poured on {date}. Leave your email and we'll tell you the day it's ready.
            </p>
            <NotifyMe fragranceId={frag.id} format={null} defaultEmail={userEmail} cta="Notify me when it's poured" note="One email on launch day, nothing else." />
          </div>

          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 18, maxWidth: 620 }} className="mo-teaser-notes">
            {([["Top", frag.top], ["Heart", frag.heart], ["Base", frag.base]] as const).map(([title, notes]) => (
              <div key={title}>
                <div style={{ ...micro, color: CREAM, fontSize: 9 }}>{title} notes</div>
                <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", fontFamily: MONO, fontSize: 12, lineHeight: 1.7, color: "rgba(243,236,220,0.8)" }}>
                  {notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-label="Meanwhile, try">
          <Container style={{ padding: "22px 32px 60px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 28, color: CREAM }}>Meanwhile, try</h2>
              <button style={btnLink} onClick={() => navigate(paths.fragrances)}>Explore the collection <Arrow size={10} /></button>
            </div>
            <div className="mo-vault-grid" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {related.map((r) => (
                <FragranceCard key={r.id} frag={r} vip={vip} onQuickView={onQuickView} />
              ))}
            </div>
          </Container>
        </section>
      )}
    </main>
  );
}
