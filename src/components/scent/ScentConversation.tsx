import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Fragrance } from "../../lib/data";
import { converse, scentAiAvailable, type ConverseTurn } from "../../lib/scentai";
import { identityOf, rankedDims, type Scentprint } from "../../lib/scentdna";
import ScentprintRing from "./ScentprintRing";
import { SD, SERIF, ctaGold, ctaQuiet, eyebrow, glass, goldA, ink, micro } from "./theme";

interface ConversationProps {
  fragrances: Fragrance[];
  onComplete: (print: Scentprint) => void;
  onExit: () => void;
}

/**
 * Discovery as a conversation instead of a questionnaire — for the visitor who
 * would bounce off thirteen cards, and for anyone who has never had the words
 * for what they like. Nothing here uses fragrance vocabulary: it asks about
 * places, weather, food and time of day.
 *
 * The Scentprint fills in beside the conversation as they talk, so the thing
 * they are earning is visible from the first answer rather than at the end.
 */
export default function ScentConversation({ fragrances, onComplete, onExit }: ConversationProps) {
  const [messages, setMessages] = useState<ConverseTurn[]>([]);
  const [print, setPrint] = useState<Scentprint | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [reading, setReading] = useState<string | undefined>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const opened = useRef(false);
  const log = useRef<HTMLDivElement | null>(null);

  const send = useCallback(
    async (history: ConverseTurn[]) => {
      setBusy(true);
      setError(null);
      const r = await converse(history, fragrances, print ?? undefined);
      setBusy(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMessages([...history, { role: "assistant", content: r.result.reply }]);
      setPrint(r.result.print);
      setConfidence(r.result.confidence);
      setReading(r.result.reading);
      setReady(r.result.ready);
    },
    [fragrances, print],
  );

  // Opening turn: the house speaks first. Deferred a tick so the first render
  // isn't chased by a state update from inside the effect body.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const t = window.setTimeout(() => void send([]), 0);
    return () => window.clearTimeout(t);
  }, [send]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const said = draft.trim();
    if (!said || busy) return;
    setDraft("");
    void send([...messages, { role: "user", content: said }]);
  };

  const dims = useMemo(() => (print ? identityOf(print).top : []), [print]);
  const strongest = print ? rankedDims(print.dims, 3).filter((d) => d.value > 0) : [];

  return (
    <section data-screen-label="Scent DNA — conversation" style={{ position: "relative", zIndex: 1, minHeight: "calc(100vh - 68px)" }}>
      <div className="sd-pad" style={{ maxWidth: 1240, margin: "0 auto", padding: "34px 32px 70px" }}>
        <div style={eyebrow}>Discover · in conversation</div>
        <h2 style={{ margin: "14px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(30px, 4.2vw, 50px)", color: SD.text, lineHeight: 1.03 }}>
          Just tell me about yourself.
        </h2>
        <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.7, color: ink(0.55), maxWidth: 560 }}>
          No fragrance knowledge, no right answers. Answer in your own words and your Scentprint draws itself as we talk.
        </p>

        <div className="sd-result-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)", gap: 40, marginTop: 34, alignItems: "start" }}>
          <div style={{ ...glass, padding: "8px 8px 18px", display: "flex", flexDirection: "column", minHeight: 460 }}>
            <div ref={log} className="mo-scroll" style={{ flex: 1, overflowY: "auto", maxHeight: 460, padding: "18px 20px", display: "grid", gap: 16, alignContent: "start" }}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    justifySelf: m.role === "user" ? "end" : "start",
                    maxWidth: "86%",
                    padding: m.role === "user" ? "11px 16px" : "0",
                    border: m.role === "user" ? `1px solid ${goldA(0.28)}` : 0,
                    background: m.role === "user" ? goldA(0.08) : "none",
                    fontFamily: m.role === "user" ? undefined : SERIF,
                    fontSize: m.role === "user" ? 14 : 21,
                    lineHeight: m.role === "user" ? 1.6 : 1.4,
                    color: m.role === "user" ? ink(0.8) : SD.text,
                  }}
                >
                  {m.content}
                </div>
              ))}
              {busy && <span style={{ ...micro, color: goldA(0.7) }} className="sd-pulse">Thinking…</span>}
              {error && <span style={{ ...micro, color: "#E08A6A" }}>{error}</span>}
            </div>

            {ready ? (
              <div style={{ padding: "14px 20px 4px", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="sd-cta" style={ctaGold} onClick={() => print && onComplete(print)} disabled={!print}>
                  Reveal my Scent DNA
                </button>
                <button className="sd-cta" style={{ ...ctaQuiet, height: 56 }} onClick={() => setReady(false)}>
                  Tell it more first
                </button>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: "flex", gap: 10, padding: "10px 12px 0", alignItems: "center" }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Answer however you like…"
                  aria-label="Your answer"
                  disabled={busy}
                  style={{ flex: 1, background: "rgba(245,242,234,0.03)", border: `1px solid ${ink(0.12)}`, outline: "none", color: SD.text, fontSize: 14.5, padding: "15px 16px" }}
                />
                <button className="sd-cta" type="submit" style={{ ...ctaGold, height: 50, padding: "0 22px", fontSize: 10 }} disabled={busy || !draft.trim()}>
                  Send
                </button>
              </form>
            )}
          </div>

          <aside style={{ display: "grid", gap: 18, justifyItems: "center" }}>
            <ScentprintRing dims={dims.length ? dims : PLACEHOLDER} size={320} labels={false} values={false} ambient={!print} id="sd-live" />
            <div style={{ textAlign: "center" }}>
              <div style={{ ...micro, color: ink(0.4) }}>{print ? "Your Scentprint, so far" : "It fills in as you answer"}</div>
              {reading && <div style={{ marginTop: 8, fontFamily: SERIF, fontSize: 20, color: SD.softGold }}>{reading}</div>}
              {strongest.length > 0 && (
                <div style={{ marginTop: 10, ...micro, color: ink(0.5) }}>
                  {strongest.map((d) => d.dim).join(" · ")}
                </div>
              )}
            </div>
            <div style={{ width: "100%", maxWidth: 280 }}>
              <div style={{ height: 1, background: ink(0.1) }}>
                <div style={{ height: 1, width: `${confidence}%`, background: `linear-gradient(90deg, ${SD.cyan}, ${SD.gold})`, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ ...micro, marginTop: 8, color: ink(0.34), textAlign: "center" }}>{confidence}% of the way there</div>
            </div>
            {!scentAiAvailable() && (
              <p style={{ ...micro, color: ink(0.34), textAlign: "center", lineHeight: 1.8, maxWidth: 280 }}>
                The concierge isn't switched on here, so this is the house's own shorter set of questions.
              </p>
            )}
            <button className="sd-cta" style={{ ...ctaQuiet, height: 42 }} onClick={onExit}>
              Take the visual version instead
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
}

/** A quiet, even shape before the first answer lands. */
const PLACEHOLDER = [
  { dim: "fresh", value: 34 },
  { dim: "citrus", value: 30 },
  { dim: "floral", value: 28 },
  { dim: "sweet", value: 30 },
  { dim: "amber", value: 32 },
  { dim: "woody", value: 34 },
  { dim: "smoky", value: 28 },
  { dim: "clean", value: 32 },
] as { dim: import("../../lib/scentdna").ScentDim; value: number }[];
