// Shared typography and button styles for the storefront (kept apart from
// ui.tsx so React Fast Refresh sees a components-only module there).
import type { CSSProperties } from "react";
import { GOLD, CREAM } from "../lib/data";

export const SERIF = "'Cormorant Garamond',serif";
export const MONO = "'Space Mono',monospace";

export const eyebrow: CSSProperties = {
  fontFamily: MONO,
  fontSize: 9.5,
  letterSpacing: "0.3em",
  textTransform: "uppercase",
  color: "rgba(201,169,97,0.85)",
};
export const micro: CSSProperties = {
  fontFamily: MONO,
  fontSize: 9,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "rgba(243,236,220,0.5)",
};
export const h2: CSSProperties = {
  margin: 0,
  fontFamily: SERIF,
  fontWeight: 400,
  fontSize: 34,
  lineHeight: 1.05,
  color: CREAM,
};
export const body: CSSProperties = { fontSize: 13.5, lineHeight: 1.7, color: "rgba(243,236,220,0.62)" };

export const btnGold: CSSProperties = {
  background: GOLD,
  color: "#0b0b0d",
  border: 0,
  cursor: "pointer",
  height: 46,
  padding: "0 24px",
  fontSize: 10.5,
  letterSpacing: "0.26em",
  textTransform: "uppercase",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
  whiteSpace: "nowrap",
};
export const btnGhost: CSSProperties = {
  ...btnGold,
  background: "none",
  color: CREAM,
  border: `1px solid rgba(201,169,97,0.55)`,
  fontWeight: 600,
};
export const btnLink: CSSProperties = {
  background: "none",
  border: 0,
  cursor: "pointer",
  color: GOLD,
  fontFamily: MONO,
  fontSize: 9.5,
  letterSpacing: "0.26em",
  textTransform: "uppercase",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

