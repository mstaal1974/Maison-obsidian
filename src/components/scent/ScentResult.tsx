import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { type Fragrance, money } from "../../lib/data";
import { DISCOVERY_BOX_PRICE, DISCOVERY_BOX_SIZE, referenceOf } from "../../lib/formats";
import {
  BEHAVIOURS,
  BEHAVIOUR_LABEL,
  BEHAVIOUR_POLES,
  DIM_SHORT,
  FAMILY_COLOUR,
  OCCASION_LABEL,
  WEARER_LABEL,
  identityOf,
  matchFragrances,
  shelfFor,
  type Scentprint,
  type Wearer,
} from "../../lib/scentdna";
import { captureScentLead, scentUrl } from "../../lib/scentShare";
import { curateSet, explainMatches, type CuratedSet, type MatchExplanation } from "../../lib/scentai";
import { learnedPrint, loadSignals, recordFeedback, recordWear, whatChanged, type ScentSignal } from "../../lib/scentLearning";
import BottleImage from "../BottleImage";
import ScentprintRing from "./ScentprintRing";
import ScentUniverse from "./ScentUniverse";
import ShareCard from "./ShareCard";
import { MONO, SD, SERIF, bodyText, ctaGhost, ctaGold, ctaQuiet, cyanA, eyebrow, glass, goldA, ink, micro } from "./theme";

export type ResultSection = "scentprint" | "matches" | "universe" | "explore";

interface ResultProps {
  print: Scentprint;
  code: string;
  fragrances: Fragrance[];
  /** Fresh from the experience (animate the reveal) or opened from a link. */
  revealed: boolean;
  onOpenProduct: (slug: string) => void;
  onAddSample: (frag: Fragrance) => void;
  onAddDiscoveryBox: (frags: Fragrance[]) => void;
  onRetake: () => void;
  onSection: (section: ResultSection) => void;
  /** A lead capture can mint a new code; the share link follows it. */
  onCode: (code: string) => void;
  /** Switching shelf re-matches in place — nobody retakes twelve questions. */
  onWearer: (wearer: Wearer) => void;
}

/**
 * Everything after the reveal, as one continuous document: the Scentprint, the
 * shareable card, the closest matches, the Scent Universe and the ways out of
 * the experience and into the house.
 */
export default function ScentResult({ print, code, fragrances, revealed, onOpenProduct, onAddSample, onAddDiscoveryBox, onRetake, onSection, onCode, onWearer }: ResultProps) {
  // Everything below reads the *learned* print: the answers they gave, plus
  // every sample worn and every word said since. The original is kept as the
  // origin so the learning can always be explained or unwound.
  const [signals, setSignals] = useState<ScentSignal[]>([]);
  const refreshSignals = useCallback(() => {
    void loadSignals(code || null).then(setSignals);
  }, [code]);
  useEffect(() => {
    let live = true;
    void loadSignals(code || null).then((rows) => live && setSignals(rows));
    return () => {
      live = false;
    };
  }, [code]);

  const shown = useMemo(() => learnedPrint(print, signals), [print, signals]);
  const moved = useMemo(() => whatChanged(print, shown), [print, shown]);

  const identity = useMemo(() => identityOf(shown), [shown]);
  const matches = useMemo(() => matchFragrances(shown, fragrances), [shown, fragrances]);
  const top = useMemo(() => matches.slice(0, 6), [matches]);
  const wearer: Wearer = shown.wearer ?? "all";
  // The Discovery Box is exactly five 10 ml, so only offer it when the shelf
  // can actually fill one.
  const boxable = matches.length >= DISCOVERY_BOX_SIZE ? top.slice(0, DISCOVERY_BOX_SIZE).map((m) => m.frag) : null;
  const url = scentUrl(code);
  const sections = useRef<Record<ResultSection, HTMLElement | null>>({ scentprint: null, matches: null, universe: null, explore: null });

  // Why each match suits them, in words. The percentages are already computed;
  // this only puts the numbers behind them into language, so the cards can say
  // something true rather than something merely plausible. Falls back to the
  // engine's own sentence, which is what shows until this resolves.
  const [explained, setExplained] = useState<Record<string, MatchExplanation>>({});
  useEffect(() => {
    let live = true;
    void explainMatches(shown, top, fragrances).then((r) => {
      if (!live || !r.ok || !r.ai) return;
      setExplained(Object.fromEntries(r.result.map((e) => [e.slug, e])));
    });
    return () => {
      live = false;
    };
  }, [shown, top, fragrances]);

  // Tell the rail which step the reader is on.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.getAttribute("data-section") as ResultSection | null;
        if (id) onSection(id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.01, 0.2, 0.5] },
    );
    Object.values(sections.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [onSection]);

  // A discovery set is not the top five scores — five near-identical bottles
  // teach nobody anything. Curation picks a spread that covers where they
  // actually live, and says what each one is for.
  const [curated, setCurated] = useState<CuratedSet | null>(null);
  const [curating, setCurating] = useState(false);
  const [curateError, setCurateError] = useState<string | null>(null);
  const curate = useCallback(async () => {
    setCurating(true);
    setCurateError(null);
    const r = await curateSet(shown, fragrances, DISCOVERY_BOX_SIZE);
    if (r.ok) setCurated(r.result);
    else setCurateError(r.error);
    setCurating(false);
  }, [shown, fragrances]);

  const register = (key: ResultSection) => (el: HTMLElement | null) => {
    sections.current[key] = el;
  };

  // The ring used to render at a fixed 520 inside whatever column it was
  // given. On a phone that meant a 350-wide drawing letterboxed inside a
  // 520-tall box: 170px of nothing above and below it, which pushed the name
  // and the description off the screen. It now takes its size from the
  // column, and the stylesheet decides how wide that column is.
  const ringWrap = useRef<HTMLDivElement | null>(null);
  const [ringSize, setRingSize] = useState(520);
  useEffect(() => {
    const el = ringWrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setRingSize(Math.round(Math.max(150, Math.min(520, w))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // What the closest match is an interpretation of. The house says this on
  // every product and match card; the Scentprint is where people decide
  // whether to believe the result, so it belongs here too.
  const topReference = top[0] ? referenceOf(top[0].frag) : null;

  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      {/* ─── 02 · Your Scentprint ─────────────────────────────────────────── */}
      <section ref={register("scentprint")} data-section="scentprint" className="sd-pad sd-result-hero" style={{ maxWidth: 1240, margin: "0 auto", padding: "36px 32px 60px" }}>
        <div className="sd-result-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 520px)", gap: 56, alignItems: "center" }}>
          <div ref={ringWrap} className="sd-ring-wrap" style={{ display: "grid", placeItems: "center" }}>
            <ScentprintRing dims={identity.top} size={ringSize} animate={revealed} />
          </div>
          <div className={revealed ? "sd-rise" : undefined} style={revealed ? { animationDelay: "0.9s" } : undefined}>
            <div style={eyebrow}>Your Scent DNA</div>
            <h1 className="sd-id-name" style={{ margin: "16px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(42px, 6vw, 74px)", lineHeight: 0.98, color: SD.text }}>{identity.primary}</h1>
            <p className="sd-id-sub" style={{ margin: "10px 0 0", fontFamily: SERIF, fontStyle: "italic", fontSize: 26, color: goldA(0.9) }}>{identity.secondary}</p>
            <div className="sd-id-traits" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
              {identity.character.map((c) => (
                <span key={c} className="sd-id-trait" style={{ ...micro, color: SD.text, border: `1px solid ${goldA(0.32)}`, padding: "7px 12px", letterSpacing: "0.24em" }}>
                  {c}
                </span>
              ))}
            </div>
            <p className="sd-id-body" style={{ ...bodyText, marginTop: 24, maxWidth: 520 }}>{identity.narrative}</p>
            {top[0] && (
              <div className="sd-id-inspired" style={{ marginTop: 18, borderLeft: `1px solid ${goldA(0.45)}`, paddingLeft: 16 }}>
                <div className="sd-id-closest" style={{ ...micro, color: ink(0.48) }}>
                  Closest match · {top[0].frag.name} · {top[0].percent}%
                </div>
                {topReference?.brand && (
                  <>
                    <div className="sd-id-reflabel" style={{ ...micro, marginTop: 9, color: goldA(0.75) }}>
                      Inspired by the scent profile of
                    </div>
                    {/* The one name on this screen the reader already knows.
                        Set like a name, not like a footnote. */}
                    <div className="sd-id-ref" style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 30, lineHeight: 1.12, color: SD.softGold, marginTop: 3 }}>
                      {topReference.brand}
                      {topReference.fragrance ? ` ${topReference.fragrance}` : ""}
                    </div>
                  </>
                )}
              </div>
            )}
            {shown.loves && (
              <p style={{ ...micro, marginTop: 14, color: ink(0.4) }}>Calibrated against a fragrance you love · {shown.loves}</p>
            )}
            <div className="sd-id-bars" style={{ marginTop: 30, display: "grid", gap: 12 }}>
              {BEHAVIOURS.filter((b) => b !== "familiarity").map((b) => (
                <BehaviourBar key={b} label={BEHAVIOUR_LABEL[b]} poles={BEHAVIOUR_POLES[b]} value={shown.behaviour[b]} />
              ))}
            </div>
            {shown.occasions.length > 0 && (
              <p style={{ ...micro, marginTop: 22, color: ink(0.46) }}>
                Built for · {shown.occasions.map((o) => OCCASION_LABEL[o]).join(" · ")}
              </p>
            )}
          </div>
        </div>

        <div style={{ marginTop: 64 }}>
          {/* The reference stays off the share card on purpose: it travels
              further than the page does. It is named on the reveal instead. */}
          <ShareCard print={shown} url={url} code={code} topMatch={top[0] ? { name: top[0].frag.name, percent: top[0].percent } : null} />
        </div>
      </section>

      {/* ─── 03 · Your closest matches ────────────────────────────────────── */}
      <section ref={register("matches")} data-section="matches" className="sd-pad" style={{ maxWidth: 1240, margin: "0 auto", padding: "50px 32px 60px", borderTop: `1px solid ${ink(0.07)}` }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={eyebrow}>03 — Matches</div>
            <h2 style={{ margin: "14px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(32px, 4.4vw, 54px)", color: SD.text, lineHeight: 1.02 }}>Your closest matches</h2>
            <p style={{ ...bodyText, marginTop: 12, maxWidth: 620 }}>
              {matches.length} fragrances scored against your Scentprint — weighted, so the dimensions you care about count the most.
            </p>
            <WearerSwitch wearer={wearer} fragrances={fragrances} onChange={onWearer} />
          </div>
          {boxable && (
            <button className="sd-cta" style={{ ...ctaGhost, height: 46 }} onClick={() => void curate()} disabled={curating}>
              {curating ? "Curating…" : `Curate my ${DISCOVERY_BOX_SIZE} · ${money(DISCOVERY_BOX_PRICE)}`}
            </button>
          )}
        </div>

        <div className="sd-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 20, marginTop: 34 }}>
          {top.map((m, i) => {
            const ref = referenceOf(m.frag);
            return (
              <article
                key={m.frag.id}
                className="sd-card"
                style={{ ...glass, overflow: "hidden", display: "flex", flexDirection: "column", animation: `sdRise 0.7s cubic-bezier(0.2,0.7,0.2,1) ${i * 0.07}s both` }}
              >
                <div style={{ position: "relative" }}>
                  <BottleImage imageUrl={m.frag.imageUrl} fallbackSrc="/assets/bottle-portrait.png" alt={m.frag.name} accent={m.frag.accent} liquid={m.frag.liquid} height={210} />
                  <div style={{ position: "absolute", top: 14, left: 14, background: "rgba(8,11,15,0.82)", border: `1px solid ${goldA(0.5)}`, padding: "6px 10px", fontFamily: MONO, fontSize: 12, letterSpacing: "0.14em", color: SD.softGold }}>
                    {m.percent}%
                  </div>
                  {i === 0 && (
                    <div style={{ position: "absolute", top: 14, right: 14, background: goldA(0.9), padding: "6px 10px", fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.22em", textTransform: "uppercase", color: SD.obsidian }}>
                      Closest
                    </div>
                  )}
                </div>
                <div style={{ padding: "20px 20px 22px", display: "flex", flexDirection: "column", flex: 1 }}>
                  <h3 style={{ margin: 0, fontFamily: SERIF, fontWeight: 300, fontSize: 27, color: SD.text, lineHeight: 1.1 }}>{m.frag.name}</h3>
                  <p style={{ margin: "8px 0 0", ...micro, color: goldA(0.85) }}>
                    {explained[m.frag.slug]?.headline ?? m.families.join(" · ")}
                  </p>
                  <div style={{ height: 2, background: ink(0.08), margin: "14px 0 0" }}>
                    <div style={{ height: 2, width: `${m.percent}%`, background: `linear-gradient(90deg, ${SD.cyan}, ${SD.gold})` }} />
                  </div>
                  <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.65, color: ink(0.58), flex: 1 }}>
                    {explained[m.frag.slug]?.body ?? m.reason}
                  </p>
                  {explained[m.frag.slug]?.caution && (
                    <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.55, color: goldA(0.75) }}>
                      One caveat · {explained[m.frag.slug]?.caution}
                    </p>
                  )}
                  <p style={{ margin: "12px 0 0", fontSize: 11.5, color: ink(0.36) }}>
                    Inspired by the scent profile of {ref.brand}
                    {ref.fragrance ? ` ${ref.fragrance}` : ""}
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                    <button className="sd-cta" style={{ ...ctaGold, height: 42, padding: "0 18px", fontSize: 9.5 }} onClick={() => onOpenProduct(m.frag.slug)}>
                      View
                    </button>
                    <button
                      className="sd-cta"
                      style={{ ...ctaQuiet, height: 42, padding: "0 16px" }}
                      onClick={() => {
                        onAddSample(m.frag);
                        void recordWear(code || null, m.frag, shown, "sample").then(refreshSignals);
                      }}
                    >
                      Add 10ml
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {curateError && (
          <p style={{ ...micro, color: goldA(0.85), marginTop: 18 }}>{curateError}</p>
        )}
        {curated && (
          <CuratedPanel
            set={curated}
            onAdd={() => onAddDiscoveryBox(curated.frags)}
            onDismiss={() => setCurated(null)}
            onOpenProduct={onOpenProduct}
          />
        )}
      </section>

      {/* ─── 04 · The Scent Universe ──────────────────────────────────────── */}
      <section ref={register("universe")} data-section="universe" className="sd-pad" style={{ maxWidth: 1240, margin: "0 auto", padding: "50px 32px 60px", borderTop: `1px solid ${ink(0.07)}` }}>
        <div style={eyebrow}>Scent Universe™</div>
        <h2 style={{ margin: "14px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(32px, 4.4vw, 54px)", color: SD.text, lineHeight: 1.02 }}>The house, mapped around you</h2>
        <p style={{ ...bodyText, marginTop: 12, maxWidth: 660 }}>
          You sit at the centre. Everything the house pours is placed by how close it is to your Scentprint, on a wheel that runs fresh at the top through warm and woody and back round to clean.
        </p>
        <div style={{ marginTop: 34 }}>
          <ScentUniverse print={shown} matches={matches} onOpen={(f) => onOpenProduct(f.slug)} onAddSample={onAddSample} />
        </div>
      </section>

      {/* ─── Explore ──────────────────────────────────────────────────────── */}
      <section ref={register("explore")} data-section="explore" className="sd-pad" style={{ maxWidth: 1240, margin: "0 auto", padding: "50px 32px 110px", borderTop: `1px solid ${ink(0.07)}` }}>
        <div className="sd-lead-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 480px)", gap: 46, alignItems: "start" }}>
          <div>
            <div style={eyebrow}>Keep it</div>
            <h2 style={{ margin: "14px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(30px, 4vw, 48px)", color: SD.text, lineHeight: 1.04 }}>
              Keep your Scentprint.
            </h2>
            <p style={{ ...bodyText, marginTop: 14, maxWidth: 560 }}>
              Leave your address and we'll hold your Scentprint on file, so it sharpens every time you tell us something new — a bottle you loved, a sample you didn't. Your link reopens this result on any device; the card is yours to download above.
            </p>
            <LeadForm print={shown} onCode={onCode} />

            <LearningPanel
              signals={signals}
              moved={moved}
              onFeedback={async (text) => {
                const r = await recordFeedback(code || null, text);
                refreshSignals();
                return r;
              }}
            />
          </div>

          <aside style={{ ...glass, padding: "30px 28px 32px" }}>
            <div style={eyebrow}>Where to next</div>
            <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
              {top[0] && (
                <button className="sd-cta" style={{ ...ctaGold, width: "100%" }} onClick={() => onOpenProduct(top[0].frag.slug)}>
                  Shop {top[0].frag.name}
                </button>
              )}
              {boxable && (
                <button className="sd-cta" style={{ ...ctaGhost, width: "100%" }} onClick={() => onAddDiscoveryBox(boxable)}>
                  Build my {DISCOVERY_BOX_SIZE}-scent discovery set
                </button>
              )}
              <button className="sd-cta" style={{ ...ctaQuiet, width: "100%" }} onClick={onRetake}>
                Retake the experience
              </button>
            </div>
            <div style={{ marginTop: 26, borderTop: `1px solid ${ink(0.08)}`, paddingTop: 20 }}>
              <div style={{ ...micro, color: ink(0.4) }}>Your Scentprint, in numbers</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px", marginTop: 14 }}>
                {identity.top.slice(0, 8).map((d) => (
                  <div key={d.dim} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: FAMILY_COLOUR[d.dim], boxShadow: `0 0 10px ${FAMILY_COLOUR[d.dim]}` }} />
                    <span style={{ flex: 1, fontSize: 12.5, color: ink(0.6) }}>{DIM_SHORT[d.dim]}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: d.value >= 60 ? SD.softGold : ink(0.4) }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

/**
 * What the profile has learned, and the way to teach it more. Shown plainly
 * because a customer who can see the thing improving has a reason to keep
 * feeding it — and because a profile that changes silently is unnerving.
 */
function LearningPanel({
  signals,
  moved,
  onFeedback,
}: {
  signals: ScentSignal[];
  moved: { key: string; from: number; to: number }[];
  onFeedback: (text: string) => Promise<{ ok: boolean; summary: string; moved: number }>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    const r = await onFeedback(value);
    setBusy(false);
    setSaid(r.summary);
    if (r.ok) setText("");
  };

  return (
    <div style={{ ...glass, marginTop: 26, padding: "24px 24px 22px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <span style={eyebrow}>Your Scentprint is learning</span>
        <span style={{ ...micro, color: ink(0.4) }}>
          {signals.length === 0 ? "No signals yet" : `${signals.length} signal${signals.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <p style={{ margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.7, color: ink(0.55) }}>
        Every sample you try and everything you tell us moves it. Your original answers are kept, so this can always be traced back.
      </p>

      {moved.length > 0 && (
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          {moved.map((m) => (
            <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 10, ...micro, color: ink(0.5) }}>
              <span style={{ flex: 1 }}>{m.key}</span>
              <span style={{ color: ink(0.3) }}>{m.from}</span>
              <span aria-hidden style={{ color: goldA(0.7) }}>→</span>
              <span style={{ color: SD.softGold }}>{m.to}</span>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} style={{ marginTop: 18 }}>
        <label style={{ ...micro, color: ink(0.45) }} htmlFor="sd-feedback">
          Tried one? Tell me how it went
        </label>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <input
            id="sd-feedback"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="It was lovely but far too sweet on me…"
            style={{ flex: 1, minWidth: 200, background: "rgba(245,242,234,0.03)", border: `1px solid ${ink(0.12)}`, outline: "none", color: SD.text, fontSize: 13.5, padding: "12px 14px" }}
          />
          <button className="sd-cta" type="submit" style={{ ...ctaQuiet, height: 44 }} disabled={busy || !text.trim()}>
            {busy ? "Reading…" : "Teach it"}
          </button>
        </div>
        {said && <p style={{ ...micro, marginTop: 12, color: goldA(0.85), lineHeight: 1.8 }}>{said}</p>}
      </form>
    </div>
  );
}

/** The curated set: what it is, and what each bottle in it is for. */
function CuratedPanel({
  set,
  onAdd,
  onDismiss,
  onOpenProduct,
}: {
  set: CuratedSet;
  onAdd: () => void;
  onDismiss: () => void;
  onOpenProduct: (slug: string) => void;
}) {
  return (
    <div className="sd-rise" style={{ ...glass, marginTop: 26, padding: "28px 26px 30px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 620 }}>
          <div style={eyebrow}>Your discovery set</div>
          <h3 style={{ margin: "12px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: 32, color: SD.text, lineHeight: 1.05 }}>{set.setName}</h3>
          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.7, color: ink(0.62) }}>{set.rationale}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="sd-cta" style={{ ...ctaGold, height: 46 }} onClick={onAdd}>
            Add the set · {money(DISCOVERY_BOX_PRICE)}
          </button>
          <button className="sd-cta" style={{ ...ctaQuiet, height: 46 }} onClick={onDismiss}>
            Not this
          </button>
        </div>
      </div>

      <ol style={{ listStyle: "none", margin: "24px 0 0", padding: 0, display: "grid", gap: 2 }}>
        {set.frags.map((f, i) => {
          const role = set.roles[f.slug];
          return (
            <li key={f.id}>
              <button
                onClick={() => onOpenProduct(f.slug)}
                className="sd-chip"
                style={{
                  display: "grid",
                  gridTemplateColumns: "34px 1fr 1.1fr auto",
                  alignItems: "center",
                  gap: 14,
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: 0,
                  borderTop: `1px solid ${ink(0.06)}`,
                  cursor: "pointer",
                  padding: "13px 4px",
                }}
              >
                <span style={{ ...micro, color: ink(0.3) }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontFamily: SERIF, fontSize: 20, color: SD.text }}>{f.name}</span>
                <span style={{ ...micro, color: goldA(0.8), letterSpacing: "0.18em" }}>{role?.role ?? ""}</span>
                <span style={{ fontSize: 12, color: ink(0.45), textAlign: "right" }}>{role?.when ?? f.tagline}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Which shelf the matches come from. The Scentprint doesn't move — only the set
 * of bottles it is compared against — so switching is instant and lossless.
 */
function WearerSwitch({ wearer, fragrances, onChange }: { wearer: Wearer; fragrances: Fragrance[]; onChange: (w: Wearer) => void }) {
  const options: Wearer[] = ["him", "her", "all"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
      <span style={{ ...micro, color: ink(0.34) }}>Pouring for</span>
      {options.map((w) => (
        <button
          key={w}
          className="sd-chip"
          aria-pressed={wearer === w}
          onClick={() => onChange(w)}
          style={{
            background: wearer === w ? goldA(0.12) : "transparent",
            border: `1px solid ${wearer === w ? goldA(0.7) : ink(0.14)}`,
            color: wearer === w ? SD.softGold : ink(0.6),
            cursor: "pointer",
            height: 32,
            padding: "0 14px",
            fontFamily: MONO,
            fontSize: 9.5,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          {WEARER_LABEL[w]} · {shelfFor(fragrances, w).length}
        </button>
      ))}
    </div>
  );
}

function BehaviourBar({ label, poles, value }: { label: string; poles: [string, string]; value: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span style={{ ...micro, color: ink(0.5) }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.18em", color: goldA(0.85), textTransform: "uppercase" }}>
          {value < 34 ? poles[0] : value > 66 ? poles[1] : "Balanced"} · {value}
        </span>
      </div>
      <div style={{ position: "relative", height: 1, background: ink(0.1), marginTop: 9 }}>
        <div style={{ position: "absolute", inset: 0, width: `${value}%`, background: `linear-gradient(90deg, ${cyanA(0.5)}, ${SD.gold})` }} />
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -4,
            left: `calc(${value}% - 4px)`,
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: SD.softGold,
            boxShadow: `0 0 12px ${goldA(0.7)}`,
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
        <span style={{ ...micro, fontSize: 8, color: ink(value < 34 ? 0.5 : 0.24) }}>{poles[0]}</span>
        <span style={{ ...micro, fontSize: 8, color: ink(value > 66 ? 0.5 : 0.24) }}>{poles[1]}</span>
      </div>
    </div>
  );
}

/** Lead capture: an email, and a separate, unticked yes to marketing. */
function LeadForm({ print, onCode }: { print: Scentprint; onCode: (code: string) => void }) {
  const [email, setEmail] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setState("busy");
      const r = await captureScentLead(email, print, marketing);
      if (r.ok) {
        if (r.code) onCode(r.code);
        setState("done");
      } else {
        setState("error");
      }
    },
    [email, marketing, print, onCode],
  );

  if (state === "done") {
    return (
      <div style={{ ...glass, marginTop: 26, padding: "24px 26px" }}>
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: 26, color: SD.softGold }}>Kept.</p>
        <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.7, color: ink(0.6) }}>
          Your Scentprint is on file{marketing ? " and you're on the inner-circle list — unsubscribe any time from your account" : ""}. Keep the link: it opens this result on any device.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 26, maxWidth: 560 }}>
      <div style={{ ...glass, display: "flex", alignItems: "center", gap: 12, padding: "8px 8px 8px 20px" }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          aria-label="Your email"
          style={{ flex: 1, background: "none", border: 0, outline: "none", color: SD.text, fontFamily: MONO, fontSize: 13, letterSpacing: "0.04em", padding: "14px 0" }}
        />
        <button className="sd-cta" type="submit" style={{ ...ctaGold, height: 46, padding: "0 22px", fontSize: 10 }} disabled={state === "busy"}>
          {state === "busy" ? "Saving…" : "Keep my Scentprint"}
        </button>
      </div>
      <label style={{ display: "flex", gap: 11, marginTop: 16, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} style={{ marginTop: 3, accentColor: SD.gold }} />
        <span style={{ fontSize: 12.5, lineHeight: 1.6, color: ink(0.52) }}>
          Also send me new batches, pours and offers. Express consent, recorded with the time and source — withdraw it any time from your account.
        </span>
      </label>
      {state === "error" && <p style={{ ...micro, color: "#E08A6A", marginTop: 12 }}>That email didn't look right — try again.</p>}
    </form>
  );
}
