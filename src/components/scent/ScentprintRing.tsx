import { useMemo } from "react";
import { DIM_SHORT, FAMILY_COLOUR, ringPath, ringPoints, type ScentDim } from "../../lib/scentdna";
import { MONO, SD, cyanA, goldA, ink } from "./theme";

interface RingProps {
  /** Already ranked and trimmed — eight to ten dimensions read best. */
  dims: { dim: ScentDim; value: number }[];
  size?: number;
  labels?: boolean;
  values?: boolean;
  /** Grow out of the centre on mount (the reveal). */
  animate?: boolean;
  /** Slow breathing, for the miniature under the hero CTA. */
  ambient?: boolean;
  id?: string;
}

/**
 * The Scentprint™ — a radar of the customer's strongest scent dimensions over a
 * fingerprint motif. Geometry comes from ringPoints() in lib/scentdna so the
 * share card's canvas draws exactly the same shape.
 */
export default function ScentprintRing({ dims, size = 460, labels = true, values = true, animate = false, ambient = false, id = "sd" }: RingProps) {
  const points = useMemo(() => ringPoints(dims), [dims]);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * (labels ? 0.335 : 0.43);
  const shape = ringPath(points, cx, cy, radius);
  const summary = dims.slice(0, 4).map((d) => `${DIM_SHORT[d.dim]} ${d.value}`).join(", ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Your Scentprint: ${summary}`}
      style={{ maxWidth: "100%", overflow: "visible", display: "block" }}
    >
      <defs>
        <radialGradient id={`${id}-fill`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={cyanA(0.42)} />
          <stop offset="58%" stopColor="rgba(0,191,255,0.14)" />
          <stop offset="100%" stopColor={goldA(0.3)} />
        </radialGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={size * 0.018} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Grid: four faint rings and a spoke per dimension. */}
      <g>
        {[0.25, 0.5, 0.75, 1].map((k, i) => (
          <circle key={k} cx={cx} cy={cy} r={radius * k} fill="none" stroke={i === 3 ? goldA(0.3) : ink(0.07)} strokeWidth={i === 3 ? 1 : 0.75} />
        ))}
        {points.map((p) => (
          <line key={p.dim} x1={cx} y1={cy} x2={cx + p.ex * radius} y2={cy + p.ey * radius} stroke={ink(0.06)} strokeWidth="0.75" />
        ))}
      </g>

      <Fingerprint cx={cx} cy={cy} r={radius * 0.3} />

      {/* The print itself. */}
      <g
        className={animate ? "sd-grow" : ambient ? "sd-breathe" : undefined}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      >
        <path d={shape} fill={`url(#${id}-fill)`} stroke={SD.gold} strokeWidth="1.2" filter={`url(#${id}-glow)`} strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={p.dim}
            cx={cx + p.x * radius}
            cy={cy + p.y * radius}
            r={size * 0.0075}
            fill={FAMILY_COLOUR[p.dim]}
            stroke={SD.obsidian}
            strokeWidth="0.8"
            className={animate ? "sd-fade" : undefined}
            style={animate ? { animationDelay: `${0.55 + i * 0.055}s` } : undefined}
          />
        ))}
      </g>

      {labels &&
        points.map((p, i) => {
          const lx = cx + p.ex * radius * 1.26;
          const ly = cy + p.ey * radius * 1.26;
          const anchor = Math.abs(p.ex) < 0.25 ? "middle" : p.ex > 0 ? "start" : "end";
          return (
            <g key={p.dim} className={animate ? "sd-fade" : undefined} style={animate ? { animationDelay: `${0.7 + i * 0.05}s` } : undefined}>
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                style={{ fontFamily: MONO, fontSize: Math.max(7.5, size * 0.0225), letterSpacing: "0.16em", textTransform: "uppercase", fill: ink(0.62) }}
              >
                {DIM_SHORT[p.dim]}
              </text>
              {values && (
                <text
                  x={lx}
                  y={ly + Math.max(11, size * 0.032)}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  style={{ fontFamily: MONO, fontSize: Math.max(8, size * 0.024), letterSpacing: "0.08em", fill: p.value >= 60 ? SD.softGold : ink(0.34) }}
                >
                  {p.value}
                </text>
              )}
            </g>
          );
        })}
    </svg>
  );
}

/** The fingerprint at the centre: five offset arcs and a core. */
function Fingerprint({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const arcs = [0.34, 0.52, 0.7, 0.88, 1.06];
  return (
    <g opacity="0.5">
      {arcs.map((k, i) => {
        const rr = r * k;
        const ox = (i % 2 === 0 ? 1 : -1) * rr * 0.08;
        return (
          <g key={k} stroke={goldA(0.45 - i * 0.05)} fill="none" strokeWidth="0.8" strokeLinecap="round">
            <path d={`M ${cx - rr + ox} ${cy} A ${rr} ${rr * 1.12} 0 0 1 ${cx + rr + ox} ${cy}`} />
            <path d={`M ${cx - rr * 0.88 + ox} ${cy + rr * 0.1} A ${rr * 0.9} ${rr} 0 0 0 ${cx + rr * 0.84 + ox} ${cy + rr * 0.08}`} opacity="0.8" />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={r * 0.11} fill={goldA(0.55)} />
    </g>
  );
}
