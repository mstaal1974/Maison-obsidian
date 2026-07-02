import type { CSSProperties } from "react";
import { GOLD } from "../lib/data";

interface LayoutSwitchProps {
  direction: "gallery" | "ledger";
  onGallery: () => void;
  onLedger: () => void;
}

const base: CSSProperties = {
  border: 0,
  cursor: "pointer",
  padding: "8px 16px",
  fontFamily: "'Space Mono',monospace",
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

export default function LayoutSwitch({ direction, onGallery, onLedger }: LayoutSwitchProps) {
  const on: CSSProperties = { ...base, background: GOLD, color: "#0b0b0d", fontWeight: 700 };
  const off: CSSProperties = { ...base, background: "transparent", color: "rgba(243,236,220,0.6)" };
  return (
    <div
      style={{
        position: "fixed",
        bottom: 22,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        gap: 11,
        background: "rgba(20,20,26,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid #1f1f27",
        padding: "8px 9px 8px 16px",
      }}
    >
      <span
        style={{
          fontFamily: "'Space Mono',monospace",
          fontSize: 9,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(243,236,220,0.45)",
        }}
      >
        Layout
      </span>
      <button onClick={onGallery} style={direction === "gallery" ? on : off}>
        Gallery
      </button>
      <button onClick={onLedger} style={direction === "ledger" ? on : off}>
        Ledger
      </button>
    </div>
  );
}
