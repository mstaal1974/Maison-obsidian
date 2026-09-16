import { useCallback, useEffect, useState } from "react";
import type { Fragrance } from "../lib/data";
import { navigate, paths } from "../lib/route";
import type { QuizAnswers } from "../lib/scentQuiz";
import { computeScentprint } from "../lib/scentQuiz";
import { encodeScentprint, type ScentDim, type Scentprint, type Wearer } from "../lib/scentdna";
import { claimScentprint, discoverUrl, fetchScentprint, loadMyScentprint, loadScentCode, loadScentprint, publishScentprint, storeScentprint } from "../lib/scentShare";
import Logo from "./Logo";
import Atmosphere from "./scent/Atmosphere";
import DiscoverQuiz from "./scent/DiscoverQuiz";
import ScentConversation from "./scent/ScentConversation";
import ScentMemory from "./scent/ScentMemory";
import ScentResult, { type ResultSection } from "./scent/ScentResult";
import ScentprintRing from "./scent/ScentprintRing";
import { MONO, SD, SERIF, ctaGhost, ctaGold, ctaQuiet, eyebrow, goldA, ink, micro } from "./scent/theme";

interface ScentDnaProps {
  fragrances: Fragrance[];
  /** The signed-in customer, so their Scentprint reaches them on any device. */
  userId?: string | null;
  /** Share code from /scent/<code>, when the visitor arrived on someone's result. */
  code: string | null;
  onOpenProduct: (slug: string) => void;
  onAddSample: (frag: Fragrance) => void;
  onAddDiscoveryBox: (frags: Fragrance[]) => void;
}

type Stage = "hero" | "quiz" | "converse" | "memory" | "building" | "result" | "opening";

const STEPS = ["Discover", "Scent DNA", "Matches", "Explore"];

// The conversational and photograph routes are built, wired and reachable —
// they are only kept off the hero while the model paths are unproven in
// production. Set this to true to put both doors back; nothing else changes.
const AI_ENTRY_POINTS: boolean = false;

/** The miniature under the hero CTA: a plausible print, not anybody's. */
const DEMO_DIMS: { dim: ScentDim; value: number }[] = [
  { dim: "fresh", value: 88 },
  { dim: "citrus", value: 74 },
  { dim: "aquatic", value: 67 },
  { dim: "aromatic", value: 72 },
  { dim: "clean", value: 86 },
  { dim: "woody", value: 79 },
  { dim: "amber", value: 41 },
  { dim: "musk", value: 62 },
  { dim: "spicy", value: 44 },
  { dim: "sweet", value: 28 },
];

/**
 * Discover Your Scent DNA — a standalone campaign experience at /discover.
 * Linkable straight from social, a QR code or an ad: no storefront navigation
 * required, its own chrome, and every result shareable as its own URL.
 */
export default function ScentDna({ fragrances, userId, code: initialCode, onOpenProduct, onAddSample, onAddDiscoveryBox }: ScentDnaProps) {
  const [stage, setStage] = useState<Stage>(initialCode ? "opening" : "hero");
  const [print, setPrint] = useState<Scentprint | null>(null);
  const [code, setCode] = useState<string>(initialCode ?? "");
  const [answers, setAnswers] = useState<QuizAnswers | undefined>(undefined);
  const [section, setSection] = useState<ResultSection>("scentprint");
  const [shared, setShared] = useState(!!initialCode);
  const [notice, setNotice] = useState<string | null>(null);
  const [stored, setStored] = useState<Scentprint | null>(() => loadScentprint());

  // A Scentprint belongs to the person, not to the browser. Signing in claims
  // the one made here before the account existed, and — on a machine that has
  // never seen it — fetches the one already on file.
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void (async () => {
      const localCode = loadScentCode();
      if (localCode) await claimScentprint(localCode);
      if (loadScentprint()) return; // this browser already has it
      const mine = await loadMyScentprint(userId);
      if (!live || !mine) return;
      storeScentprint(mine.print, mine.code);
      setStored(mine.print);
    })();
    return () => {
      live = false;
    };
  }, [userId]);

  // Campaign traffic lands here cold: the page names itself for the crawler and
  // for whatever social card the link is pasted into.
  useEffect(() => {
    const previous = document.title;
    document.title = "Discover Your Scent DNA — Maison Obsidian";
    const tags = [
      meta("name", "description", "A two-minute experience that maps your scent preferences and shows the Maison Obsidian fragrances most likely to suit you."),
      meta("property", "og:title", "Discover Your Scent DNA — Maison Obsidian"),
      meta("property", "og:description", "Find the fragrances that smell like you."),
      meta("property", "og:url", discoverUrl()),
    ];
    return () => {
      document.title = previous;
      tags.forEach((t) => t());
    };
  }, []);

  // Someone opened a shared result.
  useEffect(() => {
    if (!initialCode) return;
    let live = true;
    void fetchScentprint(initialCode).then((p) => {
      if (!live) return;
      if (p) {
        setPrint(p);
        setStage("result");
      } else {
        setNotice("That Scentprint link has expired — two minutes and you'll have your own.");
        setStage("hero");
      }
    });
    return () => {
      live = false;
    };
  }, [initialCode]);

  const begin = useCallback(() => {
    setNotice(null);
    setStage("quiz");
    window.scrollTo({ top: 0 });
  }, []);

  const openStored = useCallback(() => {
    if (!stored) {
      setNotice("No Scentprint saved on this device yet — the experience takes about two minutes.");
      return;
    }
    setPrint(stored);
    setCode(loadScentCode() ?? "");
    setShared(false);
    setStage("result");
    window.scrollTo({ top: 0 });
  }, [stored]);

  /** The reveal, whichever door they came through. */
  const reveal = useCallback((p: Scentprint, source: string) => {
    setPrint(p);
    setStage("building");
    storeScentprint(p, null);
    window.scrollTo({ top: 0 });
    // Mint the share code while the reveal plays, so Share is ready on arrival.
    void publishScentprint(p, { source }).then((minted) => {
      setCode(minted);
      storeScentprint(p, minted);
    });
  }, []);

  const complete = useCallback(
    (a: QuizAnswers) => {
      setAnswers(a);
      reveal(computeScentprint(a, fragrances), "discover");
    },
    [fragrances, reveal],
  );

  // Switching shelf keeps the Scentprint and re-mints the share code, so the
  // link someone shares opens on the shelf they were actually looking at.
  const changeWearer = useCallback(
    (next: Wearer) => {
      setPrint((current) => {
        if (!current || current.wearer === next) return current;
        const updated = { ...current, wearer: next };
        storeScentprint(updated, null);
        setCode(encodeScentprint(updated));
        void publishScentprint(updated, { source: "discover" }).then((minted) => {
          setCode(minted);
          storeScentprint(updated, minted);
        });
        return updated;
      });
    },
    [],
  );

  const retake = useCallback(() => {
    setStage("quiz");
    setShared(false);
    window.scrollTo({ top: 0 });
  }, []);

  const step = stage === "hero" || stage === "quiz" || stage === "converse" || stage === "memory" || stage === "opening" ? 0 : stage === "building" || section === "scentprint" ? 1 : section === "matches" ? 2 : 3;

  return (
    <div style={{ position: "relative", minHeight: "100vh", color: SD.text, overflowX: "hidden" }}>
      <Atmosphere intensity={stage === "result" ? 0.75 : 1} />

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(8,11,15,0.72)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: `1px solid ${ink(0.06)}`,
        }}
      >
        <div className="sd-pad" style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <button onClick={() => navigate(paths.home)} style={{ display: "flex", alignItems: "center", gap: 11, background: "none", border: 0, cursor: "pointer", padding: 0 }} aria-label="Maison Obsidian home">
            <Logo width={19} height={23} />
            <span style={{ textAlign: "left" }}>
              <span className="sd-wordmark" style={{ display: "block", fontFamily: SERIF, fontSize: 16, letterSpacing: "0.17em", fontWeight: 600, lineHeight: 1, color: SD.text, whiteSpace: "nowrap" }}>MAISON OBSIDIAN</span>
              <span style={{ display: "block", fontFamily: MONO, fontSize: 7.5, letterSpacing: "0.3em", color: goldA(0.9), marginTop: 4, textTransform: "uppercase" }}>Scent DNA</span>
            </span>
          </button>

          <nav className="sd-rail" style={{ display: "flex", alignItems: "center", gap: 22 }} aria-label="Experience progress">
            {STEPS.map((label, i) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ ...micro, color: i === step ? SD.gold : i < step ? ink(0.5) : ink(0.24), letterSpacing: "0.24em" }}>
                  {String(i + 1).padStart(2, "0")} {label}
                </span>
                {i < STEPS.length - 1 && <span aria-hidden style={{ width: 22, height: 1, background: i < step ? goldA(0.6) : ink(0.12) }} />}
              </span>
            ))}
          </nav>

          <button className="sd-cta" style={{ ...ctaQuiet, height: 38, padding: "0 16px" }} onClick={() => navigate(paths.fragrances)}>
            Shop the house
          </button>
        </div>
      </header>

      {stage === "hero" && (
        <Hero
          notice={notice}
          hasStored={!!stored}
          onBegin={begin}
          onOpenStored={openStored}
          onConverse={() => {
            setNotice(null);
            setStage("converse");
            window.scrollTo({ top: 0 });
          }}
          onMemory={() => {
            setNotice(null);
            setStage("memory");
            window.scrollTo({ top: 0 });
          }}
        />
      )}
      {stage === "opening" && <Opening />}
      {stage === "quiz" && <DiscoverQuiz fragrances={fragrances} initial={answers} onComplete={complete} onExit={() => setStage("hero")} />}
      {stage === "converse" && (
        <ScentConversation fragrances={fragrances} onComplete={(p) => reveal(p, "conversation")} onExit={() => setStage("quiz")} />
      )}
      {stage === "memory" && (
        <ScentMemory fragrances={fragrances} onComplete={(p) => reveal(p, "memory")} onExit={() => setStage("quiz")} />
      )}
      {stage === "building" && print && <Building onDone={() => setStage("result")} />}
      {stage === "result" && print && (
        <>
          {shared && <SharedBanner onBegin={begin} />}
          <ScentResult
            print={print}
            code={code}
            fragrances={fragrances}
            revealed={!shared}
            onOpenProduct={onOpenProduct}
            onAddSample={onAddSample}
            onAddDiscoveryBox={onAddDiscoveryBox}
            onRetake={retake}
            onSection={setSection}
            onCode={setCode}
            onWearer={changeWearer}
          />
        </>
      )}

      <footer style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${ink(0.06)}` }}>
        <div className="sd-pad" style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 32px", display: "flex", justifyContent: "space-between", gap: "10px 18px", flexWrap: "wrap" }}>
          <span style={{ ...micro, color: ink(0.3), lineHeight: 1.9 }}>© 2026 Maison Obsidian · Scentprint™ · Scent Universe™</span>
          <span style={{ ...micro, color: ink(0.3), lineHeight: 1.9 }}>maisonobsidian.com.au/discover</span>
        </div>
      </footer>
    </div>
  );
}

/** Adds a meta tag if the page lacks one; returns a function that restores it. */
function meta(attr: "name" | "property", key: string, content: string): () => void {
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (existing) {
    const before = existing.content;
    existing.content = content;
    return () => {
      existing.content = before;
    };
  }
  const el = document.createElement("meta");
  el.setAttribute(attr, key);
  el.content = content;
  document.head.appendChild(el);
  return () => el.remove();
}

function Hero({
  notice,
  hasStored,
  onBegin,
  onOpenStored,
  onConverse,
  onMemory,
}: {
  notice: string | null;
  hasStored: boolean;
  onBegin: () => void;
  onOpenStored: () => void;
  onConverse: () => void;
  onMemory: () => void;
}) {
  return (
    <section
      data-screen-label="Scent DNA — hero"
      className="sd-pad"
      style={{ position: "relative", zIndex: 1, minHeight: "calc(100vh - 68px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "56px 32px 80px", textAlign: "center" }}
    >
      <div style={{ maxWidth: 900 }}>
        <div className="sd-fade" style={{ ...eyebrow, letterSpacing: "0.42em" }}>
          Discover Your Scent DNA
        </div>
        <h1 className="sd-rise" style={{ margin: "26px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(40px, 7.4vw, 96px)", lineHeight: 0.96, letterSpacing: "-0.015em", color: SD.text }}>
          What does your personality smell like?
        </h1>
        <p className="sd-rise" style={{ margin: "26px auto 0", maxWidth: 640, fontSize: "clamp(15px, 1.6vw, 19px)", lineHeight: 1.7, color: ink(0.66), animationDelay: "0.12s" }}>
          Discover your Scent DNA and explore the fragrances that sit closest to you.
        </p>
        <p className="sd-rise" style={{ margin: "14px auto 0", maxWidth: 620, fontSize: 14, lineHeight: 1.7, color: ink(0.42), animationDelay: "0.18s" }}>
          A two-minute experience that maps your scent preferences and shows the Maison Obsidian fragrances most likely to suit you.
        </p>

        <div className="sd-rise sd-hero-cta" style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 40, flexWrap: "wrap", animationDelay: "0.24s" }}>
          <button className="sd-cta" style={ctaGold} onClick={onBegin}>
            Discover My Scent DNA
          </button>
        </div>
        <p className="sd-fade" style={{ ...micro, marginTop: 18, color: ink(0.4) }}>2 minutes · No fragrance knowledge required</p>

        {/* Three doors to the same Scentprint — some people would rather talk
            than tap, and some arrive with a photograph. */}
        {AI_ENTRY_POINTS && (
          <div className="sd-fade sd-hero-cta" style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 22, flexWrap: "wrap", animationDelay: "0.32s" }}>
            <button className="sd-cta" style={{ ...ctaGhost, height: 44 }} onClick={onConverse}>
              Or just talk to me
            </button>
            <button className="sd-cta" style={{ ...ctaGhost, height: 44 }} onClick={onMemory}>
              Or start from a photo
            </button>
          </div>
        )}

        {/* Proof of the prize: they will receive something visual. */}
        <div className="sd-fade" style={{ display: "grid", placeItems: "center", marginTop: 34, animationDelay: "0.4s" }}>
          <div style={{ position: "relative" }}>
            <ScentprintRing dims={DEMO_DIMS} size={260} labels={false} values={false} ambient id="sd-mini" />
            <span style={{ position: "absolute", left: "50%", bottom: -26, transform: "translateX(-50%)", ...micro, color: ink(0.34), whiteSpace: "nowrap" }}>
              Your Scentprint™, in about two minutes
            </span>
          </div>
        </div>

        <div style={{ marginTop: 62, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <span style={{ ...micro, color: ink(0.38) }}>Already have a Scentprint?</span>
          <button className="sd-cta" style={{ ...ctaGhost, height: 44, opacity: hasStored ? 1 : 0.7 }} onClick={onOpenStored}>
            View My Profile
          </button>
          {notice && (
            <p role="status" style={{ ...micro, color: goldA(0.85), marginTop: 4, maxWidth: 420, lineHeight: 1.7, letterSpacing: "0.14em" }}>
              {notice}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Opening() {
  return (
    <section style={{ position: "relative", zIndex: 1, minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <p style={{ ...micro, color: goldA(0.8) }}>Opening this Scentprint…</p>
    </section>
  );
}

const BUILD_LINES = ["Reading your preferences…", "Weighing sixteen scent dimensions…", "Building your Scent DNA…"];

/** The reveal. Deliberately slow — the wait is part of the prize. */
function Building({ onDone }: { onDone: () => void }) {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const quick = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const beat = quick ? 320 : 1150;
    const timers = [
      window.setTimeout(() => setLine(1), beat),
      window.setTimeout(() => setLine(2), beat * 2),
      window.setTimeout(onDone, beat * 3 + (quick ? 120 : 500)),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [onDone]);

  return (
    <section style={{ position: "relative", zIndex: 1, minHeight: "calc(100vh - 68px)", display: "grid", placeItems: "center", padding: "0 24px" }}>
      <div style={{ textAlign: "center" }}>
        <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden style={{ display: "block", margin: "0 auto" }}>
          <circle cx="100" cy="100" r="86" fill="none" stroke={ink(0.07)} strokeWidth="1" />
          <circle
            cx="100"
            cy="100"
            r="86"
            fill="none"
            stroke={SD.gold}
            strokeWidth="1.6"
            strokeLinecap="round"
            className="sd-trace"
            style={{ ["--sd-dash" as string]: "540", strokeDasharray: 540, animationDuration: "3.4s", transform: "rotate(-90deg)", transformOrigin: "100px 100px" }}
          />
          {[0.3, 0.5, 0.7].map((k, i) => (
            <path
              key={k}
              d={`M ${100 - 60 * k} 100 A ${60 * k} ${66 * k} 0 0 1 ${100 + 60 * k} 100`}
              fill="none"
              stroke={goldA(0.4 - i * 0.08)}
              strokeWidth="1"
              className="sd-pulse"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          ))}
          <circle cx="100" cy="100" r="3" fill={SD.softGold} />
        </svg>
        <p key={line} className="sd-fade" style={{ marginTop: 40, fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(24px, 3.6vw, 40px)", color: SD.text }}>
          {BUILD_LINES[line]}
        </p>
        <p style={{ ...micro, marginTop: 14, color: ink(0.32) }}>Sixteen dimensions · {String(line + 1).padStart(2, "0")} / 03</p>
      </div>
    </section>
  );
}

function SharedBanner({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="sd-pad" style={{ position: "relative", zIndex: 1, maxWidth: 1240, margin: "0 auto", padding: "26px 32px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
          border: `1px solid ${goldA(0.3)}`,
          background: "linear-gradient(100deg, rgba(201,163,91,0.12), rgba(0,191,255,0.05))",
          padding: "16px 20px",
        }}
      >
        <span style={{ fontFamily: SERIF, fontSize: 22, color: SD.text }}>You're looking at someone else's Scent DNA.</span>
        <button className="sd-cta" style={{ ...ctaGold, height: 44 }} onClick={onBegin}>
          Discover mine
        </button>
      </div>
    </div>
  );
}
