import { useEffect, useMemo, useState } from "react";
import type { Fragrance } from "../../lib/data";
import { fromLabel, profileOf, referenceOf } from "../../lib/formats";
import {
  DIM_SHORT,
  FAMILY_COLOUR,
  WHEEL_ANGLE,
  WHEEL_COMPASS,
  identityOf,
  scentUniverse,
  type ScentDim,
  type ScentMatch,
  type Scentprint,
  type UniverseNode,
} from "../../lib/scentdna";
import { exploreMatches, type ExplorePick, type Stretch } from "../../lib/scentai";
import { MONO, SD, SERIF, ctaGhost, ctaGold, cyanA, eyebrow, glass, goldA, ink, micro } from "./theme";

interface UniverseProps {
  print: Scentprint;
  matches: ScentMatch[];
  onOpen: (frag: Fragrance) => void;
  onAddSample: (frag: Fragrance) => void;
}

const VIEW = 1000;
const CENTRE = VIEW / 2;
const MAX_R = 350;

const STRETCH_COLOUR: Record<Stretch, string> = {
  home: "#8FD98A",
  step: SD.softGold,
  leap: SD.cyan,
};
const STRETCH_LABEL: Record<Stretch, string> = {
  home: "Close to home",
  step: "A step out",
  leap: "A leap",
};

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

const LENSES: { id: string; label: string; dims: ScentDim[] }[] = [
  { id: "all", label: "Everything", dims: [] },
  { id: "fresh", label: "Fresh", dims: ["fresh", "citrus", "aquatic", "clean", "green"] },
  { id: "woody", label: "Woody", dims: ["woody", "aromatic"] },
  { id: "warm", label: "Warm", dims: ["amber", "sweet", "gourmand", "spicy"] },
  { id: "floral", label: "Floral", dims: ["floral", "powdery", "fruity", "musk"] },
  { id: "dark", label: "Dark", dims: ["smoky"] },
];

/**
 * The Scent Universe™ — you at the centre, every fragrance in the house placed
 * around you. Distance is compatibility; direction is how the scent differs
 * from your Scentprint, so warmer compositions gather on one side and fresher
 * ones on the other. The ranked list underneath is the same data, reachable
 * without a pointer.
 */
export default function ScentUniverse({ print, matches, onOpen, onAddSample }: UniverseProps) {
  const nodes = useMemo(() => scentUniverse(print, matches), [print, matches]);
  const [selectedId, setSelectedId] = useState<string>(() => matches[0]?.frag.id ?? "");
  const [lens, setLens] = useState("all");
  const identity = identityOf(print);

  // Familiar ↔ Adventurous. Seeded from their own Scentprint, because the
  // experience already asked how far they like to stray — then theirs to move.
  // Distance on the map stays compatibility and bearing stays family; this
  // changes which scents the map argues for, not where they sit.
  const [appetite, setAppetite] = useState(() => clampPct(print.behaviour.adventurousness));
  const [picks, setPicks] = useState<ExplorePick[]>([]);
  const [guiding, setGuiding] = useState(false);

  useEffect(() => {
    let live = true;
    // Debounced: dragging the slider shouldn't fire a call per pixel, and the
    // busy flag is set when the call actually starts, not while we wait.
    const t = window.setTimeout(() => {
      if (!live) return;
      setGuiding(true);
      void exploreMatches(print, matches, matches.map((m) => m.frag), appetite).then((r) => {
        if (!live) return;
        setPicks(r.ok ? r.result : []);
        setGuiding(false);
      });
    }, 420);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [print, matches, appetite]);

  const pickBySlug = useMemo(() => new Map(picks.map((p) => [p.slug, p])), [picks]);
  const active = nodes.find((n) => n.match.frag.id === selectedId) ?? nodes[0];
  const lensDims = LENSES.find((l) => l.id === lens)?.dims ?? [];
  // Only the three closest carry a standing label; the rest surface on hover.
  // Where two of those would sit on top of each other, the lower one drops
  // beneath its node instead of being lost behind its neighbour.
  const labelSide = useMemo(() => placeLabels(nodes, active?.match.frag.id, identity.primary), [nodes, active, identity.primary]);
  const inLens = (n: UniverseNode) => !lensDims.length || lensDims.includes(n.family);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 26 }}>
        {LENSES.map((l) => (
          <button
            key={l.id}
            className="sd-chip"
            onClick={() => setLens(l.id)}
            aria-pressed={lens === l.id}
            style={{
              background: lens === l.id ? goldA(0.12) : "transparent",
              border: `1px solid ${lens === l.id ? goldA(0.7) : ink(0.14)}`,
              color: lens === l.id ? SD.softGold : ink(0.6),
              cursor: "pointer",
              height: 34,
              padding: "0 16px",
              fontFamily: MONO,
              fontSize: 9.5,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      <AppetiteControl value={appetite} busy={guiding} onChange={setAppetite} />

      <div className="sd-universe-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 400px", gap: 32, alignItems: "start" }}>
        <div style={{ ...glass, padding: 14, position: "relative" }}>
          <svg viewBox={`0 0 ${VIEW} ${VIEW}`} style={{ display: "block", width: "100%", height: "auto" }} role="presentation">
            <defs>
              <radialGradient id="sdCore" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(230,201,137,0.95)" />
                <stop offset="55%" stopColor="rgba(201,163,91,0.35)" />
                <stop offset="100%" stopColor="rgba(201,163,91,0)" />
              </radialGradient>
              <radialGradient id="sdField" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(0,191,255,0.12)" />
                <stop offset="70%" stopColor="rgba(0,191,255,0.03)" />
                <stop offset="100%" stopColor="rgba(0,191,255,0)" />
              </radialGradient>
            </defs>

            <circle cx={CENTRE} cy={CENTRE} r={MAX_R + 40} fill="url(#sdField)" />

            {/* The wheel: which way is fresh, which way is woody. */}
            {WHEEL_COMPASS.map((dim) => {
              const a = WHEEL_ANGLE[dim];
              const lx = CENTRE + Math.cos(a) * (MAX_R + 36);
              const ly = CENTRE + Math.sin(a) * (MAX_R + 36);
              return (
                <g key={dim}>
                  <line
                    x1={CENTRE + Math.cos(a) * (MAX_R * 0.2)}
                    y1={CENTRE + Math.sin(a) * (MAX_R * 0.2)}
                    x2={CENTRE + Math.cos(a) * MAX_R}
                    y2={CENTRE + Math.sin(a) * MAX_R}
                    stroke={ink(0.045)}
                    strokeWidth="1"
                  />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor={Math.abs(Math.cos(a)) < 0.3 ? "middle" : Math.cos(a) > 0 ? "start" : "end"}
                    dominantBaseline="middle"
                    style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.26em", textTransform: "uppercase", fill: goldA(0.42) }}
                  >
                    {DIM_SHORT[dim]}
                  </text>
                </g>
              );
            })}

            {/* Orbit bands: closest, adjacent, outer — named in the legend below. */}
            {[0.42, 0.72, 1].map((k, i) => (
              <circle
                key={k}
                className={i % 2 === 0 ? "sd-orbit" : "sd-orbit-slow"}
                cx={CENTRE}
                cy={CENTRE}
                r={MAX_R * k}
                fill="none"
                stroke={i === 0 ? goldA(0.32) : cyanA(0.2)}
                strokeWidth="1"
                strokeDasharray={i === 0 ? "2 7" : "1 9"}
                style={{ transformOrigin: `${CENTRE}px ${CENTRE}px` }}
              />
            ))}

            {/* You. */}
            <g>
              <circle cx={CENTRE} cy={CENTRE} r={118} fill="url(#sdCore)" className="sd-breathe" style={{ transformOrigin: `${CENTRE}px ${CENTRE}px` }} />
              <circle cx={CENTRE} cy={CENTRE} r={46} fill="rgba(8,11,15,0.92)" stroke={goldA(0.75)} strokeWidth="1.4" />
              {[0.34, 0.55, 0.78].map((k, i) => (
                <path
                  key={k}
                  d={`M ${CENTRE - 46 * k} ${CENTRE + 4} A ${46 * k} ${52 * k} 0 0 1 ${CENTRE + 46 * k} ${CENTRE + 4}`}
                  fill="none"
                  stroke={goldA(0.7 - i * 0.14)}
                  strokeWidth="1.4"
                />
              ))}
              <text x={CENTRE} y={CENTRE + 76} textAnchor="middle" style={{ fontFamily: MONO, fontSize: 16, letterSpacing: "0.32em", fill: SD.gold }}>
                YOU
              </text>
              <text x={CENTRE} y={CENTRE + 102} textAnchor="middle" style={{ fontFamily: SERIF, fontSize: 26, fill: ink(0.62) }}>
                {identity.primary}
              </text>
            </g>

            {/* The house, placed around you. */}
            {nodes.map((n) => {
              const x = CENTRE + Math.cos(n.angle) * n.radius * MAX_R;
              const y = CENTRE + Math.sin(n.angle) * n.radius * MAX_R;
              const isActive = n.match.frag.id === active?.match.frag.id;
              const lit = inLens(n);
              const r = 9 + (n.match.percent / 100) * 11;
              const colour = FAMILY_COLOUR[n.family];
              return (
                <g
                  key={n.match.frag.id}
                  className="sd-node"
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.match.frag.name}, ${n.match.percent}% compatible`}
                  onClick={() => setSelectedId(n.match.frag.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(n.match.frag.id);
                    }
                  }}
                  opacity={lit ? 1 : 0.16}
                  style={{ transformOrigin: `${x}px ${y}px` }}
                >
                  <line x1={CENTRE} y1={CENTRE} x2={x} y2={y} stroke={isActive ? goldA(0.5) : cyanA(0.09)} strokeWidth={isActive ? 1.2 : 0.7} />
                  {isActive && <circle cx={x} cy={y} r={r + 12} fill="none" stroke={goldA(0.55)} strokeWidth="1" className="sd-pulse" />}
                  <circle cx={x} cy={y} r={r} fill={`${colour}26`} stroke={isActive ? SD.softGold : colour} strokeWidth={isActive ? 2 : 1.2} />
                  {pickBySlug.get(n.match.frag.slug) && (
                    <circle
                      cx={x}
                      cy={y}
                      r={r + 7}
                      fill="none"
                      stroke={STRETCH_COLOUR[pickBySlug.get(n.match.frag.slug)!.stretch]}
                      strokeWidth="1.4"
                      strokeDasharray="3 4"
                      opacity={0.85}
                    />
                  )}
                  <circle cx={x} cy={y} r={r * 0.34} fill={isActive ? SD.softGold : colour} />
                  <text
                    className="sd-node-label"
                    x={x + (x - CENTRE > 40 ? 6 : x - CENTRE < -40 ? -6 : 0)}
                    y={labelSide[n.match.frag.id] === "below" ? y + r + 26 : y - r - 13}
                    // Names lean outward, so a scent sitting near the middle
                    // never writes its label across "you".
                    textAnchor={x - CENTRE > 40 ? "start" : x - CENTRE < -40 ? "end" : "middle"}
                    style={{
                      fontFamily: SERIF,
                      fontSize: isActive ? 26 : 22,
                      fill: isActive ? SD.text : ink(0.72),
                      pointerEvents: "none",
                      paintOrder: "stroke",
                      stroke: SD.obsidian,
                      strokeWidth: 5,
                      strokeLinejoin: "round",
                      opacity: isActive || labelSide[n.match.frag.id] ? 1 : 0,
                    }}
                  >
                    {n.match.frag.name}
                  </text>
                  {isActive && (
                    <text x={x} y={labelSide[n.match.frag.id] === "below" ? y - r - 14 : y + r + 26} textAnchor="middle" style={{ fontFamily: MONO, fontSize: 17, letterSpacing: "0.16em", fill: SD.gold, pointerEvents: "none" }}>
                      {n.match.percent}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <p style={{ ...micro, margin: "14px 4px 2px", color: ink(0.32) }}>
            Closer means more compatible · bearing is the scent's own family · rings: closest, adjacent, outer field
          </p>
        </div>

        {active && <NodePanel node={active} pick={pickBySlug.get(active.match.frag.slug)} onOpen={onOpen} onAddSample={onAddSample} />}
      </div>

      <RankedList nodes={nodes} activeId={active?.match.frag.id ?? ""} onSelect={setSelectedId} />
    </div>
  );
}

function NodePanel({ node, pick, onOpen, onAddSample }: { node: UniverseNode; pick?: ExplorePick; onOpen: (f: Fragrance) => void; onAddSample: (f: Fragrance) => void }) {
  const { frag, percent, reason, families, dna } = node.match;
  const ref = referenceOf(frag);
  return (
    <aside style={{ ...glass, padding: "28px 26px 30px", position: "sticky", top: 96 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14 }}>
        <span style={eyebrow}>Compatibility</span>
        <span style={{ fontFamily: SERIF, fontSize: 46, lineHeight: 1, color: SD.softGold }}>{percent}%</span>
      </div>
      <div style={{ height: 2, background: ink(0.08), marginTop: 14 }}>
        <div style={{ height: 2, width: `${percent}%`, background: `linear-gradient(90deg, ${SD.cyan}, ${SD.gold})`, transition: "width 0.6s ease" }} />
      </div>
      <h3 style={{ margin: "22px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: 36, lineHeight: 1.05, color: SD.text }}>{frag.name}</h3>
      <p style={{ margin: "8px 0 0", ...micro, color: goldA(0.8) }}>
        {families.join(" · ")}
      </p>
      {pick && (
        <p style={{ margin: "16px 0 0", fontSize: 13.5, lineHeight: 1.65, color: STRETCH_COLOUR[pick.stretch] }}>
          <span style={{ ...micro, color: STRETCH_COLOUR[pick.stretch], marginRight: 8 }}>{STRETCH_LABEL[pick.stretch]}</span>
          {pick.reason}
        </p>
      )}
      <p style={{ margin: "16px 0 0", fontSize: 14, lineHeight: 1.7, color: ink(0.62) }}>{reason}</p>
      <p style={{ margin: "14px 0 0", fontSize: 12.5, lineHeight: 1.65, color: ink(0.42) }}>
        Inspired by the scent profile of {ref.brand}
        {ref.fragrance ? ` ${ref.fragrance}` : ""} · {profileOf(frag).join(" · ")}
      </p>

      <div style={{ marginTop: 22, display: "grid", gap: 8 }}>
        {node.match.shared.length > 0 && (
          <Row label="Shared with you" value={node.match.shared.map((d) => DIM_SHORT[d]).join(", ")} />
        )}
        <Row label="Strongest here" value={`${DIM_SHORT[node.family]} ${dna[node.family]}`} />
        <Row label="Notes" value={[...frag.top, ...frag.heart, ...frag.base].slice(0, 5).join(", ")} />
        <Row label="From" value={fromLabel(frag)} />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
        <button className="sd-cta" style={{ ...ctaGold, height: 46, padding: "0 22px", fontSize: 10 }} onClick={() => onOpen(frag)}>
          View fragrance
        </button>
        <button className="sd-cta" style={{ ...ctaGhost, height: 46, padding: "0 20px", fontSize: 10 }} onClick={() => onAddSample(frag)}>
          Add 10ml
        </button>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "128px 1fr", gap: 12, borderTop: `1px solid ${ink(0.06)}`, paddingTop: 8 }}>
      <span style={micro}>{label}</span>
      <span style={{ fontSize: 12.5, color: ink(0.66), lineHeight: 1.55 }}>{value}</span>
    </div>
  );
}

function RankedList({ nodes, activeId, onSelect }: { nodes: UniverseNode[]; activeId: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const shown = open ? nodes : nodes.slice(0, 8);
  return (
    <div style={{ marginTop: 34 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, borderBottom: `1px solid ${ink(0.08)}`, paddingBottom: 12 }}>
        <span style={eyebrow}>The whole house, ranked</span>
        <button className="sd-chip" onClick={() => setOpen((o) => !o)} style={{ background: "none", border: 0, cursor: "pointer", ...micro, color: goldA(0.9) }}>
          {open ? "Show fewer" : `Show all ${nodes.length}`}
        </button>
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {shown.map((n, i) => (
          <li key={n.match.frag.id}>
            <button
              onClick={() => onSelect(n.match.frag.id)}
              className="sd-chip"
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr auto 72px",
                alignItems: "center",
                gap: 14,
                width: "100%",
                textAlign: "left",
                background: n.match.frag.id === activeId ? goldA(0.07) : "none",
                border: 0,
                borderBottom: `1px solid ${ink(0.05)}`,
                cursor: "pointer",
                padding: "13px 10px",
              }}
            >
              <span style={{ ...micro, color: ink(0.28) }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: SERIF, fontSize: 20, color: n.match.frag.id === activeId ? SD.softGold : SD.text }}>{n.match.frag.name}</span>
              <span style={{ ...micro, color: ink(0.4) }}>{n.match.families.join(" · ")}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.1em", color: SD.gold, textAlign: "right" }}>{n.match.percent}%</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Which standing labels the map can carry: the three closest, placed above their
 * node unless that would land on one already there, in which case they drop
 * below. Anything still colliding stays hidden until it is hovered or selected.
 */
function placeLabels(nodes: UniverseNode[], activeId: string | undefined, primary: string): Record<string, "above" | "below" | undefined> {
  const out: Record<string, "above" | "below" | undefined> = {};
  // "YOU" and your family name own the middle of the map; nothing overwrites them.
  const taken: { x: number; y: number; w: number }[] = [
    { x: CENTRE, y: CENTRE + 76, w: 120 },
    { x: CENTRE, y: CENTRE + 102, w: primary.length * 14 },
  ];
  // The selected scent always keeps its name, so its box is claimed first.
  const chosen = nodes.find((n) => n.match.frag.id === activeId);
  if (chosen) {
    const r = 9 + (chosen.match.percent / 100) * 11;
    taken.push({
      x: CENTRE + Math.cos(chosen.angle) * chosen.radius * MAX_R,
      y: CENTRE + Math.sin(chosen.angle) * chosen.radius * MAX_R - r - 13,
      w: chosen.match.frag.name.length * 13,
    });
  }
  const candidates = nodes
    .filter((n) => n.match.frag.id !== activeId)
    .sort((a, b) => b.match.percent - a.match.percent)
    .slice(0, 3);
  for (const n of candidates) {
    const x = CENTRE + Math.cos(n.angle) * n.radius * MAX_R;
    const y = CENTRE + Math.sin(n.angle) * n.radius * MAX_R;
    const w = n.match.frag.name.length * 11;
    const r = 9 + (n.match.percent / 100) * 11;
    for (const [side, ly] of [["above", y - r - 13] as const, ["below", y + r + 26] as const]) {
      if (taken.some((t) => Math.abs(t.y - ly) < 28 && Math.abs(t.x - x) < (t.w + w) / 2)) continue;
      out[n.match.frag.id] = side;
      taken.push({ x, y: ly, w });
      break;
    }
  }
  return out;
}

/**
 * How far from themselves they want to be taken. The map's geometry doesn't
 * move — distance is still compatibility — but which scents it argues for does,
 * and each one comes with what it keeps and what it changes.
 */
function AppetiteControl({ value, busy, onChange }: { value: number; busy: boolean; onChange: (v: number) => void }) {
  return (
    <div style={{ ...glass, padding: "18px 22px 14px", marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <span style={{ ...micro, color: ink(0.5) }}>How far from yourself?</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.18em", color: goldA(0.85), textTransform: "uppercase" }}>
          {busy ? "Reading the field…" : value < 34 ? "Familiar" : value > 66 ? "Adventurous" : "Distinctive"}
        </span>
      </div>
      <input
        className="sd-range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="How far from your Scentprint to explore, familiar to adventurous"
        aria-valuetext={value < 34 ? "Familiar" : value > 66 ? "Adventurous" : "Distinctive"}
        style={{ marginTop: 6 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ ...micro, fontSize: 8, color: ink(value < 34 ? 0.5 : 0.24) }}>Familiar</span>
        <span style={{ ...micro, fontSize: 8, color: ink(value > 66 ? 0.5 : 0.24) }}>Adventurous</span>
      </div>
    </div>
  );
}
