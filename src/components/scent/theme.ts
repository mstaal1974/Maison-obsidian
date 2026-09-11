// Palette and surfaces for the Scent DNA experience. Darker and cooler than the
// storefront: obsidian glass, gold edge lighting, faint cyan data.
import type { CSSProperties } from "react";

export const SD = {
  obsidian: "#080B0F",
  charcoal: "#101820",
  navy: "#0F1E3D",
  cyan: "#00BFFF",
  gold: "#C9A35B",
  softGold: "#E6C989",
  text: "#F5F2EA",
} as const;

/** Off-white text at an opacity. */
export const ink = (a: number): string => `rgba(245,242,234,${a})`;
export const cyanA = (a: number): string => `rgba(0,191,255,${a})`;
export const goldA = (a: number): string => `rgba(201,163,91,${a})`;

export const SERIF = "'Cormorant Garamond',serif";
export const MONO = "'Space Mono',monospace";
export const SANS = "'Hanken Grotesk',system-ui,sans-serif";

/** Black glass: smoked transparency, a gold hairline, a soft shadow. */
export const glass: CSSProperties = {
  background: "linear-gradient(160deg, rgba(16,24,32,0.86), rgba(8,11,15,0.92))",
  border: `1px solid ${goldA(0.18)}`,
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  boxShadow: "0 30px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(245,242,234,0.05)",
};

export const eyebrow: CSSProperties = {
  fontFamily: MONO,
  fontSize: 9.5,
  letterSpacing: "0.34em",
  textTransform: "uppercase",
  color: goldA(0.9),
};

export const micro: CSSProperties = {
  fontFamily: MONO,
  fontSize: 9,
  letterSpacing: "0.26em",
  textTransform: "uppercase",
  color: ink(0.45),
};

export const display: CSSProperties = {
  margin: 0,
  fontFamily: SERIF,
  fontWeight: 300,
  lineHeight: 1.02,
  letterSpacing: "-0.01em",
  color: SD.text,
};

export const bodyText: CSSProperties = {
  fontFamily: SANS,
  fontSize: 15,
  lineHeight: 1.75,
  color: ink(0.6),
};

/** The primary action: gold, generous, unmistakable. */
export const ctaGold: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  height: 56,
  padding: "0 34px",
  border: 0,
  cursor: "pointer",
  background: `linear-gradient(100deg, ${SD.gold}, ${SD.softGold})`,
  color: SD.obsidian,
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: "0.28em",
  textTransform: "uppercase",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

export const ctaGhost: CSSProperties = {
  ...ctaGold,
  height: 50,
  background: "rgba(245,242,234,0.02)",
  border: `1px solid ${goldA(0.42)}`,
  color: SD.text,
  fontWeight: 500,
};

export const ctaQuiet: CSSProperties = {
  ...ctaGhost,
  border: `1px solid ${ink(0.16)}`,
  color: ink(0.66),
  letterSpacing: "0.22em",
  fontSize: 10,
};
