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
  identityOf,
  matchFragrances,
  type Scentprint,
} from "../../lib/scentdna";
import { captureScentLead, scentUrl } from "../../lib/scentShare";
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
}

/**
 * Everything after the reveal, as one continuous document: the Scentprint, the
 * shareable card, the closest matches, the Scent Universe and the ways out of
 * the experience and into the house.
 */
export default function ScentResult({ print, code, fragrances, revealed, onOpenProduct, onAddSample, onAddDiscoveryBox, onRetake, onSection, onCode }: ResultProps) {
  const identity = useMemo(() => identityOf(print), [print]);
  const matches = useMemo(() => matchFragrances(print, fragrances), [print, fragrances]);
  const top = matches.slice(0, 6);
  const url = scentUrl(code);
  const sections = useRef<Record<ResultSection, HTMLElement | null>>({ scentprint: null, matches: null, universe: null, explore: null });

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

  const register = (key: ResultSection) => (el: HTMLElement | null) => {
    sections.current[key] = el;
  };

  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      {/* ─── 02 · Your Scentprint ─────────────────────────────────────────── */}
      <section ref={register("scentprint")} data-section="scentprint" className="sd-pad" style={{ maxWidth: 1240, margin: "0 auto", padding: "36px 32px 60px" }}>
        <div className="sd-result-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 520px)", gap: 56, alignItems: "center" }}>
          <div style={{ display: "grid", placeItems: "center" }}>
            <ScentprintRing dims={identity.top} size={520} animate={revealed} />
          </div>
          <div className={revealed ? "sd-rise" : undefined} style={revealed ? { animationDelay: "0.9s" } : undefined}>
            <div style={eyebrow}>Your Scent DNA</div>
            <h1 style={{ margin: "16px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(42px, 6vw, 74px)", lineHeight: 0.98, color: SD.text }}>{identity.primary}</h1>
            <p style={{ margin: "10px 0 0", fontFamily: SERIF, fontStyle: "italic", fontSize: 26, color: goldA(0.9) }}>{identity.secondary}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
              {identity.character.map((c) => (
                <span key={c} style={{ ...micro, color: SD.text, border: `1px solid ${goldA(0.32)}`, padding: "7px 12px", letterSpacing: "0.24em" }}>
                  {c}
                </span>
              ))}
            </div>
            <p style={{ ...bodyText, marginTop: 24, maxWidth: 520 }}>{identity.narrative}</p>
            {print.loves && (
              <p style={{ ...micro, marginTop: 14, color: ink(0.4) }}>Calibrated against a fragrance you love · {print.loves}</p>
            )}
            <div style={{ marginTop: 30, display: "grid", gap: 12 }}>
              {BEHAVIOURS.filter((b) => b !== "familiarity").map((b) => (
                <BehaviourBar key={b} label={BEHAVIOUR_LABEL[b]} poles={BEHAVIOUR_POLES[b]} value={print.behaviour[b]} />
              ))}
            </div>
            {print.occasions.length > 0 && (
              <p style={{ ...micro, marginTop: 22, color: ink(0.46) }}>
                Built for · {print.occasions.map((o) => OCCASION_LABEL[o]).join(" · ")}
              </p>
            )}
          </div>
        </div>

        <div style={{ marginTop: 64 }}>
          <ShareCard print={print} url={url} code={code} topMatch={top[0] ? { name: top[0].frag.name, percent: top[0].percent } : null} />
        </div>
      </section>

      {/* ─── 03 · Your closest matches ────────────────────────────────────── */}
      <section ref={register("matches")} data-section="matches" className="sd-pad" style={{ maxWidth: 1240, margin: "0 auto", padding: "50px 32px 60px", borderTop: `1px solid ${ink(0.07)}` }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={eyebrow}>03 — Matches</div>
            <h2 style={{ margin: "14px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(32px, 4.4vw, 54px)", color: SD.text, lineHeight: 1.02 }}>Your closest matches</h2>
            <p style={{ ...bodyText, marginTop: 12, maxWidth: 620 }}>
              Every fragrance in the house scored against your Scentprint — weighted, so the dimensions you care about count the most.
            </p>
          </div>
          <button className="sd-cta" style={{ ...ctaGhost, height: 46 }} onClick={() => onAddDiscoveryBox(top.slice(0, DISCOVERY_BOX_SIZE).map((m) => m.frag))}>
            Try my top {DISCOVERY_BOX_SIZE} · {money(DISCOVERY_BOX_PRICE)}
          </button>
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
                  <p style={{ margin: "8px 0 0", ...micro, color: goldA(0.85) }}>{m.families.join(" · ")}</p>
                  <div style={{ height: 2, background: ink(0.08), margin: "14px 0 0" }}>
                    <div style={{ height: 2, width: `${m.percent}%`, background: `linear-gradient(90deg, ${SD.cyan}, ${SD.gold})` }} />
                  </div>
                  <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.65, color: ink(0.58), flex: 1 }}>{m.reason}</p>
                  <p style={{ margin: "12px 0 0", fontSize: 11.5, color: ink(0.36) }}>
                    Inspired by the scent profile of {ref.brand}
                    {ref.fragrance ? ` ${ref.fragrance}` : ""}
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                    <button className="sd-cta" style={{ ...ctaGold, height: 42, padding: "0 18px", fontSize: 9.5 }} onClick={() => onOpenProduct(m.frag.slug)}>
                      View
                    </button>
                    <button className="sd-cta" style={{ ...ctaQuiet, height: 42, padding: "0 16px" }} onClick={() => onAddSample(m.frag)}>
                      Add 10ml
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ─── 04 · The Scent Universe ──────────────────────────────────────── */}
      <section ref={register("universe")} data-section="universe" className="sd-pad" style={{ maxWidth: 1240, margin: "0 auto", padding: "50px 32px 60px", borderTop: `1px solid ${ink(0.07)}` }}>
        <div style={eyebrow}>Scent Universe™</div>
        <h2 style={{ margin: "14px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(32px, 4.4vw, 54px)", color: SD.text, lineHeight: 1.02 }}>The house, mapped around you</h2>
        <p style={{ ...bodyText, marginTop: 12, maxWidth: 660 }}>
          You sit at the centre. Everything the house pours is placed by how close it is to your Scentprint, on a wheel that runs fresh at the top through warm and woody and back round to clean.
        </p>
        <div style={{ marginTop: 34 }}>
          <ScentUniverse print={print} matches={matches} onOpen={(f) => onOpenProduct(f.slug)} onAddSample={onAddSample} />
        </div>
      </section>

      {/* ─── Explore ──────────────────────────────────────────────────────── */}
      <section ref={register("explore")} data-section="explore" className="sd-pad" style={{ maxWidth: 1240, margin: "0 auto", padding: "50px 32px 110px", borderTop: `1px solid ${ink(0.07)}` }}>
        <div className="sd-lead-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 480px)", gap: 46, alignItems: "start" }}>
          <div>
            <div style={eyebrow}>Keep it</div>
            <h2 style={{ margin: "14px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(30px, 4vw, 48px)", color: SD.text, lineHeight: 1.04 }}>
              Have your Scentprint sent to you.
            </h2>
            <p style={{ ...bodyText, marginTop: 14, maxWidth: 560 }}>
              We'll email the card and your match list, and keep your Scentprint on file so it sharpens every time you tell us something new — a bottle you loved, a sample you didn't.
            </p>
            <LeadForm print={print} onCode={onCode} />
          </div>

          <aside style={{ ...glass, padding: "30px 28px 32px" }}>
            <div style={eyebrow}>Where to next</div>
            <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
              {top[0] && (
                <button className="sd-cta" style={{ ...ctaGold, width: "100%" }} onClick={() => onOpenProduct(top[0].frag.slug)}>
                  Shop {top[0].frag.name}
                </button>
              )}
              <button className="sd-cta" style={{ ...ctaGhost, width: "100%" }} onClick={() => onAddDiscoveryBox(top.slice(0, DISCOVERY_BOX_SIZE).map((m) => m.frag))}>
                Build my {DISCOVERY_BOX_SIZE}-scent discovery set
              </button>
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
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: 26, color: SD.softGold }}>On its way.</p>
        <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.7, color: ink(0.6) }}>
          Your Scentprint is saved{marketing ? " and you're on the inner-circle list — unsubscribe any time from your account" : ""}. Keep the link: it opens this result on any device.
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
          {state === "busy" ? "Sending…" : "Send it to me"}
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
