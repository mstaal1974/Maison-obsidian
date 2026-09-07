import type { CSSProperties } from "react";
import { GOLD } from "../lib/data";

// Shared inline styles for the admin console and its panels.

export const label: CSSProperties = {
  fontFamily: "'Space Mono',monospace",
  fontSize: 9,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "rgba(243,236,220,0.45)",
};
export const field: CSSProperties = {
  width: "100%",
  background: "none",
  border: "1px solid #1f1f27",
  outline: "none",
  height: 40,
  padding: "0 12px",
  color: "#f3ecdc",
  fontFamily: "'Space Mono',monospace",
  fontSize: 12,
};
export const btnGold: CSSProperties = {
  background: GOLD,
  color: "#0b0b0d",
  border: 0,
  cursor: "pointer",
  height: 40,
  padding: "0 20px",
  fontSize: 10.5,
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  fontWeight: 600,
};
export const btnGhost: CSSProperties = {
  background: "none",
  color: "rgba(243,236,220,0.75)",
  border: "1px solid #1f1f27",
  cursor: "pointer",
  height: 40,
  padding: "0 18px",
  fontSize: 10.5,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  fontWeight: 600,
};
export const chip: CSSProperties = {
  display: "inline-block",
  border: "1px solid rgba(201,169,97,0.35)",
  background: "rgba(201,169,97,0.06)",
  color: "#f3ecdc",
  padding: "5px 10px",
  fontFamily: "'Space Mono',monospace",
  fontSize: 10.5,
  letterSpacing: "0.08em",
};

/** Backdrop behind a transparent bottle PNG: subtle glow in the scent's accent. */
export function bottleBackdrop(accent: string, liquid: string): string {
  return `radial-gradient(55% 60% at 50% 58%, ${accent}2e, transparent 72%), radial-gradient(80% 40% at 50% 100%, ${liquid}66, transparent 70%), linear-gradient(180deg, #15151b 0%, #0b0b0d 100%)`;
}
