import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Fragrance } from "../../lib/data";
import {
  QUESTIONS,
  emptyAnswers,
  isAnswered,
  lovedSuggestions,
  type ChoiceOption,
  type ChoiceQuestion,
  type LovedQuestion,
  type MultiQuestion,
  type QuizAnswers,
  type SliderQuestion,
  type WearerQuestion,
} from "../../lib/scentQuiz";
import type { OccasionKey, Wearer } from "../../lib/scentdna";
import Glyph from "./Glyph";
import { MONO, SD, SERIF, ctaGhost, ctaGold, ctaQuiet, eyebrow, glass, goldA, ink, micro } from "./theme";

interface QuizProps {
  fragrances: Fragrance[];
  initial?: QuizAnswers;
  onComplete: (answers: QuizAnswers) => void;
  onExit: () => void;
}

/**
 * The discovery experience. One question per screen, each a scene rather than a
 * form row: single choices advance themselves, sliders and the occasion picker
 * wait for Continue, and the fragrance-you-love field can always be skipped.
 */
export default function DiscoverQuiz({ fragrances, initial, onComplete, onExit }: QuizProps) {
  const [answers, setAnswers] = useState<QuizAnswers>(() => initial ?? emptyAnswers());
  const [index, setIndex] = useState(0);
  const advancing = useRef<number | null>(null);
  const question = QUESTIONS[index];
  const last = index === QUESTIONS.length - 1;

  useEffect(() => () => {
    if (advancing.current) window.clearTimeout(advancing.current);
  }, []);

  const go = useCallback(
    (next: number) => {
      if (advancing.current) window.clearTimeout(advancing.current);
      if (next < 0) {
        onExit();
        return;
      }
      if (next >= QUESTIONS.length) return;
      setIndex(next);
    },
    [onExit],
  );

  const finish = useCallback((a: QuizAnswers) => onComplete(a), [onComplete]);

  // A beat to register the choice, then move on — no Continue tax.
  const advance = useCallback(
    (next: QuizAnswers) => {
      setAnswers(next);
      advancing.current = window.setTimeout(() => (last ? finish(next) : setIndex((i) => Math.min(QUESTIONS.length - 1, i + 1))), 340);
    },
    [last, finish],
  );

  const choose = useCallback(
    (q: ChoiceQuestion, optionId: string) => advance({ ...answers, choices: { ...answers.choices, [q.id]: optionId } }),
    [answers, advance],
  );

  const chooseWearer = useCallback((wearer: Wearer) => advance({ ...answers, wearer }), [answers, advance]);

  // 1–4 pick an answer; ← → move between questions.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (question.kind === "choice" && /^[1-9]$/.test(e.key)) {
        const opt = question.options[Number(e.key) - 1];
        if (opt) choose(question, opt.id);
        return;
      }
      if (question.kind === "wearer" && /^[1-9]$/.test(e.key)) {
        const opt = question.options[Number(e.key) - 1];
        if (opt) chooseWearer(opt.id);
        return;
      }
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, choose, chooseWearer, go, index]);

  const answered = isAnswered(question, answers);

  return (
    <section data-screen-label="Scent DNA — discovery" style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="sd-pad" style={{ width: "100%", maxWidth: 1240, margin: "0 auto", padding: "26px 32px 0" }}>
        <QuizProgress index={index} total={QUESTIONS.length} />
      </div>

      <div className="sd-pad" style={{ flex: 1, width: "100%", maxWidth: 1240, margin: "0 auto", padding: "30px 32px 72px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div key={question.id} className="sd-rise">
          <div style={{ ...eyebrow }}>{question.eyebrow}</div>
          <h2 style={{ margin: "14px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(30px, 4.4vw, 52px)", lineHeight: 1.04, color: SD.text, maxWidth: 900 }}>{question.prompt}</h2>
          {question.help && <p style={{ margin: "12px 0 0", fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: ink(0.4) }}>{question.help}</p>}

          <div style={{ marginTop: 38 }}>
            {question.kind === "choice" && <ChoiceGrid question={question} selected={answers.choices[question.id]} onPick={(id) => choose(question, id)} />}
            {question.kind === "wearer" && <WearerField question={question} selected={answers.wearer} onPick={chooseWearer} />}
            {question.kind === "slider" && (
              <SliderField
                question={question}
                value={answers.sliders[question.id] ?? question.initial}
                onChange={(v) => setAnswers({ ...answers, sliders: { ...answers.sliders, [question.id]: v } })}
              />
            )}
            {question.kind === "multi" && (
              <OccasionField
                question={question}
                selected={answers.occasions}
                onToggle={(id) =>
                  setAnswers({
                    ...answers,
                    occasions: answers.occasions.includes(id) ? answers.occasions.filter((x) => x !== id) : [...answers.occasions, id],
                  })
                }
              />
            )}
            {question.kind === "loved" && (
              <LovedField question={question} fragrances={fragrances} value={answers.loved} onChange={(loved) => setAnswers({ ...answers, loved })} />
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 44, flexWrap: "wrap" }}>
            <button className="sd-cta" style={{ ...ctaQuiet, height: 46 }} onClick={() => go(index - 1)}>
              {index === 0 ? "Back to start" : "Back"}
            </button>
            {question.kind !== "choice" && question.kind !== "wearer" && (
              <button
                className="sd-cta"
                style={{ ...(last ? ctaGold : ctaGhost), opacity: answered ? 1 : 0.45, cursor: answered ? "pointer" : "not-allowed" }}
                disabled={!answered}
                onClick={() => (last ? finish(answers) : go(index + 1))}
              >
                {last ? "Reveal my Scent DNA" : "Continue"}
              </button>
            )}
            {question.kind === "loved" && !answers.loved.trim() && (
              <button className="sd-cta" style={{ ...ctaQuiet, height: 46 }} onClick={() => finish(answers)}>
                Skip — I'm new to this
              </button>
            )}
            {(question.kind === "choice" || question.kind === "wearer") && (
              <span style={{ ...micro, color: ink(0.3) }}>Pick one · keys 1–{question.options.length}</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function QuizProgress({ index, total }: { index: number; total: number }) {
  const pct = ((index + 1) / total) * 100;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ ...micro, color: goldA(0.85) }}>Question {String(index + 1).padStart(2, "0")} / {total}</span>
        <span className="sd-quiet-note" style={{ ...micro }}>Nothing is stored until you ask us to</span>
      </div>
      <div style={{ marginTop: 12, height: 1, background: ink(0.1), position: "relative" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${SD.cyan}, ${SD.gold})`,
            transition: "width 0.5s cubic-bezier(0.2,0.7,0.2,1)",
            boxShadow: `0 0 14px ${goldA(0.5)}`,
          }}
        />
      </div>
    </div>
  );
}

function ChoiceGrid({ question, selected, onPick }: { question: ChoiceQuestion; selected?: string; onPick: (id: string) => void }) {
  const cols = question.columns ?? 4;
  return (
    <div
      className={cols >= 4 ? "sd-grid-4" : "sd-grid-3"}
      style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 18 }}
      role="radiogroup"
      aria-label={question.prompt}
    >
      {question.options.map((o, i) => (
        <OptionCard key={o.id} option={o} index={i} active={selected === o.id} onPick={() => onPick(o.id)} />
      ))}
    </div>
  );
}

type CardFace = Pick<ChoiceOption, "label" | "note" | "glyph" | "tone">;

function OptionCard({ option, index, active, onPick, tall = false }: { option: CardFace; index: number; active: boolean; onPick: () => void; tall?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onPick}
      className="sd-card"
      style={{
        ...glass,
        border: `1px solid ${active ? goldA(0.85) : goldA(0.16)}`,
        boxShadow: active ? `0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px ${goldA(0.4)}, 0 0 46px ${goldA(0.16)}` : glass.boxShadow,
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        overflow: "hidden",
        animation: `sdRise 0.7s cubic-bezier(0.2,0.7,0.2,1) ${index * 0.06}s both`,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "block",
          position: "relative",
          height: tall ? 220 : 152,
          background: `radial-gradient(120% 110% at 28% 0%, ${option.tone[1]}2E 0%, rgba(0,0,0,0) 62%), linear-gradient(165deg, ${option.tone[0]} 0%, ${SD.obsidian} 100%)`,
        }}
      >
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: option.tone[1] }}>
          <Glyph name={option.glyph} size={tall ? 92 : 66} opacity={active ? 1 : 0.82} />
        </span>
        <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, background: active ? goldA(0.7) : ink(0.08) }} />
      </span>
      <span style={{ display: "block", padding: "18px 20px 22px" }}>
        <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1.15, color: active ? SD.softGold : SD.text }}>{option.label}</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: active ? SD.gold : ink(0.22) }}>{active ? "◆" : String(index + 1)}</span>
        </span>
        <span style={{ display: "block", marginTop: 8, fontSize: 12.5, lineHeight: 1.6, color: ink(0.5) }}>{option.note}</span>
      </span>
    </button>
  );
}

function WearerField({ question, selected, onPick }: { question: WearerQuestion; selected: Wearer | null; onPick: (w: Wearer) => void }) {
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="sd-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 18 }} role="radiogroup" aria-label={question.prompt}>
        {question.options.map((o, i) => (
          <OptionCard key={o.id} option={o} index={i} active={selected === o.id} onPick={() => onPick(o.id)} tall />
        ))}
      </div>
      <button
        type="button"
        className="sd-chip"
        aria-pressed={selected === "all"}
        onClick={() => onPick("all")}
        style={{
          marginTop: 18,
          background: "none",
          border: 0,
          borderBottom: `1px solid ${selected === "all" ? goldA(0.7) : ink(0.16)}`,
          cursor: "pointer",
          padding: "8px 2px",
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: selected === "all" ? SD.softGold : ink(0.5),
        }}
      >
        No preference — show me the whole house
      </button>
    </div>
  );
}

function SliderField({ question, value, onChange }: { question: SliderQuestion; value: number; onChange: (v: number) => void }) {
  const [low, mid, high] = question.poles;
  const label = value < 34 ? low : value > 66 ? high : mid;
  return (
    <div style={{ ...glass, padding: "38px 34px 30px", maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <span style={{ fontFamily: SERIF, fontSize: 34, color: SD.softGold, lineHeight: 1 }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.2em", color: ink(0.45) }}>{value}/100</span>
      </div>
      <input
        className="sd-range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${question.prompt} — ${low} to ${high}`}
        aria-valuetext={label}
        style={{ marginTop: 26 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {question.poles.map((p, i) => (
          <span key={p} style={{ ...micro, color: label === p ? SD.gold : ink(0.35), textAlign: i === 0 ? "left" : i === 1 ? "center" : "right", flex: 1 }}>
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

function OccasionField({ question, selected, onToggle }: { question: MultiQuestion; selected: OccasionKey[]; onToggle: (id: OccasionKey) => void }) {
  return (
    <div className="sd-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14, maxWidth: 980 }}>
      {question.options.map((o, i) => {
        const active = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(o.id)}
            className="sd-card"
            style={{
              ...glass,
              border: `1px solid ${active ? goldA(0.8) : goldA(0.15)}`,
              padding: "20px 22px",
              cursor: "pointer",
              textAlign: "left",
              animation: `sdRise 0.6s cubic-bezier(0.2,0.7,0.2,1) ${i * 0.05}s both`,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                aria-hidden
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 2,
                  border: `1px solid ${active ? SD.gold : ink(0.24)}`,
                  background: active ? `linear-gradient(140deg, ${SD.gold}, ${SD.softGold})` : "transparent",
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 auto",
                }}
              >
                {active && (
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                    <path d="M1 5.4 3.8 8 9 2" stroke={SD.obsidian} strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <span style={{ fontFamily: SERIF, fontSize: 21, color: active ? SD.softGold : SD.text }}>{o.label}</span>
            </span>
            <span style={{ display: "block", marginTop: 8, paddingLeft: 28, fontSize: 12, color: ink(0.45) }}>{o.note}</span>
          </button>
        );
      })}
    </div>
  );
}

function LovedField({ question, fragrances, value, onChange }: { question: LovedQuestion; fragrances: Fragrance[]; value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(() => lovedSuggestions(value, fragrances), [value, fragrances]);
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ ...glass, padding: "10px 10px 10px 22px", display: "flex", alignItems: "center", gap: 14, border: `1px solid ${focused ? goldA(0.6) : goldA(0.18)}` }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={goldA(0.8)} strokeWidth="1.2" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          placeholder="Start typing a fragrance or house…"
          aria-label={question.prompt}
          autoComplete="off"
          style={{ flex: 1, background: "none", border: 0, outline: "none", color: SD.text, fontFamily: SERIF, fontSize: 22, padding: "12px 0" }}
        />
        {value && (
          <button type="button" onClick={() => onChange("")} style={{ ...ctaQuiet, height: 38, padding: "0 16px" }}>
            Clear
          </button>
        )}
      </div>
      {focused && suggestions.length > 0 && (
        <div style={{ ...glass, marginTop: 8, padding: 6 }}>
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onMouseDown={() => onChange(s.label)}
              className="sd-chip"
              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, borderBottom: `1px solid ${ink(0.05)}`, cursor: "pointer", padding: "12px 14px", color: SD.text }}
            >
              <span style={{ fontFamily: SERIF, fontSize: 18 }}>{s.label}</span>
              <span style={{ display: "block", ...micro, marginTop: 4 }}>{s.sub}</span>
            </button>
          ))}
        </div>
      )}
      <p style={{ marginTop: 14, fontSize: 12.5, color: ink(0.4), lineHeight: 1.7 }}>
        We use it to place you, never to copy it — the house pours its own compositions inspired by the profiles people already know.
      </p>
    </div>
  );
}
