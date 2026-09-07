// Line-art product illustrations for the format selector: the three bottle
// sizes, the wooden-cap car diffuser, the body wash pump, the moisturiser tube
// and the Ritual set box. Drawn in the house palette with the scent's liquid.

const GLASS = "rgba(243,236,220,0.55)";
const DARK = "#141418";
const GOLD = "#c9a961";
const WOOD = "#6b4a2b";

export function BottleGlyph({ size, liquid, height = 88 }: { size: "10" | "30" | "50"; liquid: string; height?: number }) {
  // Discovery vial is slim; 30 and 50 ml share the square shoulder bottle at two scales.
  if (size === "10") {
    return (
      <svg width={height * 0.36} height={height} viewBox="0 0 32 88" fill="none" aria-hidden>
        <rect x="11" y="4" width="10" height="10" fill={DARK} stroke={GLASS} strokeWidth="1" />
        <rect x="12" y="14" width="8" height="4" fill={GOLD} opacity="0.8" />
        <rect x="9" y="18" width="14" height="64" rx="2" fill={DARK} stroke={GLASS} strokeWidth="1" />
        <rect x="11" y="34" width="10" height="46" fill={liquid} opacity="0.9" />
        <rect x="12" y="46" width="8" height="16" fill="none" stroke={GOLD} strokeWidth="0.6" opacity="0.7" />
      </svg>
    );
  }
  const s = size === "50" ? 1 : 0.84;
  const w = 58 * s;
  return (
    <svg width={w} height={height} viewBox="0 0 58 88" fill="none" aria-hidden style={{ transformOrigin: "bottom", transform: `scale(${s})` }}>
      <rect x="20" y="2" width="18" height="16" rx="1" fill={DARK} stroke={GLASS} strokeWidth="1" />
      <rect x="18" y="18" width="22" height="5" fill={GOLD} opacity="0.85" />
      <path d="M8 30c0-4 3-7 7-7h28c4 0 7 3 7 7v52a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" fill={DARK} stroke={GLASS} strokeWidth="1" />
      <rect x="11" y="36" width="36" height="47" fill={liquid} opacity="0.9" />
      <rect x="17" y="44" width="24" height="26" fill="none" stroke={GOLD} strokeWidth="0.7" opacity="0.8" />
      <path d="M22 52h14M23 57h12M25 62h8" stroke={GOLD} strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

export function DiffuserGlyph({ liquid, height = 88 }: { liquid: string; height?: number }) {
  return (
    <svg width={height * 0.5} height={height} viewBox="0 0 44 88" fill="none" aria-hidden>
      <path d="M22 0v22" stroke={GOLD} strokeWidth="1.2" />
      <path d="M17 6c0 4 10 4 10 0M17 12c0 4 10 4 10 0" stroke={GOLD} strokeWidth="0.8" opacity="0.7" />
      <path d="M12 22h20l-2 12H14z" fill={WOOD} stroke="#8a6238" strokeWidth="0.8" />
      <rect x="15" y="34" width="14" height="5" fill={GOLD} opacity="0.85" />
      <path d="M8 46c0-4 3-7 7-7h14c4 0 7 3 7 7v34a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5z" fill={DARK} stroke={GLASS} strokeWidth="1" />
      <rect x="11" y="50" width="22" height="31" fill={liquid} opacity="0.85" />
      <path d="M16 62h12M17 67h10" stroke={GOLD} strokeWidth="0.9" opacity="0.6" />
    </svg>
  );
}

export function PumpGlyph({ height = 88 }: { height?: number }) {
  return (
    <svg width={height * 0.42} height={height} viewBox="0 0 36 88" fill="none" aria-hidden>
      <path d="M18 10v8M12 10h9c3 0 5 2 5 4v0" stroke={GLASS} strokeWidth="1.2" strokeLinecap="round" />
      <rect x="13" y="18" width="10" height="8" fill={DARK} stroke={GLASS} strokeWidth="1" />
      <path d="M6 32c0-4 3-6 6-6h12c3 0 6 2 6 6v50a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill={DARK} stroke={GLASS} strokeWidth="1" />
      <path d="M12 46h12M13 51h10M14 56h8" stroke={GOLD} strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

export function TubeGlyph({ height = 88 }: { height?: number }) {
  return (
    <svg width={height * 0.4} height={height} viewBox="0 0 34 88" fill="none" aria-hidden>
      <rect x="11" y="4" width="12" height="9" rx="1" fill={DARK} stroke={GLASS} strokeWidth="1" />
      <path d="M9 13h16l5 12v55a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V25z" fill={DARK} stroke={GLASS} strokeWidth="1" />
      <path d="M11 40h12M12 45h10M13 50h8" stroke={GOLD} strokeWidth="1" opacity="0.6" />
      <path d="M4 80h26" stroke={GLASS} strokeWidth="1" />
    </svg>
  );
}

export function SetGlyph({ liquid, height = 88 }: { liquid: string; height?: number }) {
  return (
    <svg width={height * 1.9} height={height} viewBox="0 0 168 88" fill="none" aria-hidden>
      <rect x="2" y="12" width="164" height="72" rx="2" fill="#0e0e12" stroke={GLASS} strokeWidth="1" />
      <rect x="6" y="16" width="156" height="64" fill="#101015" stroke="rgba(201,169,97,0.25)" strokeWidth="0.8" />
      <g transform="translate(22 24)">
        <rect x="8" y="2" width="12" height="9" fill={DARK} stroke={GLASS} strokeWidth="0.8" />
        <path d="M2 16c0-3 2-5 5-5h14c3 0 5 2 5 5v34a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" fill={DARK} stroke={GLASS} strokeWidth="0.8" />
        <rect x="4" y="20" width="20" height="30" fill={liquid} opacity="0.85" />
      </g>
      <g transform="translate(62 24)">
        <rect x="6" y="0" width="6" height="8" fill={DARK} stroke={GLASS} strokeWidth="0.8" />
        <path d="M0 14c0-3 2-6 6-6h6c4 0 6 3 6 6v36a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3z" fill={DARK} stroke={GLASS} strokeWidth="0.8" />
      </g>
      <g transform="translate(88 24)">
        <rect x="6" y="2" width="8" height="7" fill={DARK} stroke={GLASS} strokeWidth="0.8" />
        <path d="M4 9h12l4 9v32a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V18z" fill={DARK} stroke={GLASS} strokeWidth="0.8" />
      </g>
      <g transform="translate(118 20)">
        <rect x="12" y="0" width="3" height="10" fill={GOLD} opacity="0.8" />
        <path d="M8 10h11l-1 6H9z" fill={WOOD} />
        <path d="M4 22c0-3 2-5 5-5h9c3 0 5 2 5 5v24a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill={DARK} stroke={GLASS} strokeWidth="0.8" />
        <rect x="7" y="26" width="13" height="20" fill={liquid} opacity="0.85" />
      </g>
      <text x="84" y="78" textAnchor="middle" fontFamily="'Cormorant Garamond',serif" fontSize="7" letterSpacing="1.5" fill={GOLD}>MAISON OBSIDIAN</text>
    </svg>
  );
}

/** Picks the illustration for a format key. */
export function FormatGlyph({ formatKey, liquid, height }: { formatKey: string; liquid: string; height?: number }) {
  switch (formatKey) {
    case "perf10": return <BottleGlyph size="10" liquid={liquid} height={height} />;
    case "perf30": return <BottleGlyph size="30" liquid={liquid} height={height} />;
    case "perf50": return <BottleGlyph size="50" liquid={liquid} height={height} />;
    case "car": return <DiffuserGlyph liquid={liquid} height={height} />;
    case "wash": return <PumpGlyph height={height} />;
    case "moist": return <TubeGlyph height={height} />;
    default: return <SetGlyph liquid={liquid} height={height} />;
  }
}
