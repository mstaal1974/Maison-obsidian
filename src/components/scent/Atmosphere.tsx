import { useMemo } from "react";
import { SD, cyanA, goldA } from "./theme";

/**
 * The ambient field behind the whole experience: obsidian ground, three drifting
 * clouds of vapour, a faint lattice of scent molecules and a rock silhouette
 * catching gold along its top edge. Pure CSS and SVG — no canvas, no libraries,
 * and all of it still under prefers-reduced-motion.
 */
export default function Atmosphere({ intensity = 1 }: { intensity?: number }) {
  // Deterministic so the lattice is identical on every render and every visit.
  const molecules = useMemo(() => buildLattice(), []);
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", background: SD.obsidian, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(78% 52% at 12% 0%, rgba(15,30,61,0.8) 0%, rgba(15,30,61,0) 64%),
                       radial-gradient(64% 46% at 92% 16%, rgba(0,191,255,0.08) 0%, rgba(0,191,255,0) 62%),
                       radial-gradient(90% 62% at 50% 108%, rgba(201,163,91,0.1) 0%, rgba(201,163,91,0) 64%),
                       linear-gradient(180deg, ${SD.obsidian} 0%, ${SD.charcoal} 48%, ${SD.obsidian} 100%)`,
        }}
      />
      <div className="sd-vapour sd-vapour-a" style={{ top: "-14%", left: "-10%", width: "62vw", height: "62vw", background: `radial-gradient(circle, ${cyanA(0.16 * intensity)} 0%, rgba(0,191,255,0) 68%)` }} />
      <div className="sd-vapour sd-vapour-b" style={{ top: "24%", right: "-16%", width: "54vw", height: "54vw", background: `radial-gradient(circle, ${goldA(0.14 * intensity)} 0%, rgba(201,163,91,0) 68%)` }} />
      <div className="sd-vapour sd-vapour-c" style={{ bottom: "-22%", left: "22%", width: "70vw", height: "70vw", background: `radial-gradient(circle, rgba(15,30,61,${0.34 * intensity}) 0%, rgba(15,30,61,0) 70%)` }} />

      {/* Scent molecules: a slow, almost-still data lattice. */}
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.26 * intensity }}>
        <g className="sd-lattice">
          {molecules.links.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={cyanA(0.34)} strokeWidth="0.5" />
          ))}
          {molecules.nodes.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={i % 4 === 0 ? goldA(0.6) : cyanA(0.5)} />
          ))}
        </g>
      </svg>

      {/* Obsidian rock: a faceted horizon with gold edge lighting. */}
      <svg viewBox="0 0 1440 320" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: "34vh", minHeight: 180 }}>
        <defs>
          <linearGradient id="sdRock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0C1117" />
            <stop offset="100%" stopColor={SD.obsidian} />
          </linearGradient>
        </defs>
        <path d="M0 214 168 150 330 208 486 128 640 196 792 138 946 206 1104 146 1268 212 1440 158V320H0z" fill="url(#sdRock)" />
        <path d="M0 214 168 150 330 208 486 128 640 196 792 138 946 206 1104 146 1268 212 1440 158" fill="none" stroke={goldA(0.34)} strokeWidth="1" />
        <path d="M168 150 168 320M486 128 486 320M792 138 792 320M1104 146 1104 320" stroke="rgba(245,242,234,0.05)" strokeWidth="1" />
      </svg>
    </div>
  );
}

interface Lattice {
  nodes: { x: number; y: number; r: number }[];
  links: { x1: number; y1: number; x2: number; y2: number }[];
}

/** Twenty-six points on a jittered grid, joined to their nearest neighbours. */
function buildLattice(): Lattice {
  const nodes: Lattice["nodes"] = [];
  let seed = 77;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      if ((row + col) % 3 === 0) continue;
      nodes.push({
        x: 90 + col * 168 + (rand() - 0.5) * 110,
        y: 110 + row * 190 + (rand() - 0.5) * 110,
        r: 1.2 + rand() * 2.4,
      });
    }
  }
  const links: Lattice["links"] = [];
  nodes.forEach((a, i) => {
    nodes.slice(i + 1).forEach((b) => {
      if (Math.hypot(a.x - b.x, a.y - b.y) < 250) links.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    });
  });
  return { nodes, links };
}
