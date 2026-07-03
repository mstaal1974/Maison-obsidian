import { type Fragrance, GOLD, shade, money } from "../lib/data";

interface FragranceCardProps {
  frag: Fragrance;
  effectiveCommitted: number;
  vip: boolean;
  showInspiration: boolean;
  onOpen: () => void;
}

export default function FragranceCard({
  frag,
  effectiveCommitted,
  vip,
  showInspiration,
  onOpen,
}: FragranceCardProps) {
  const pct = Math.min(100, Math.round((effectiveCommitted / frag.moq) * 100));
  const met = effectiveCommitted >= frag.moq;
  const locked = !!frag.vipOnly && !vip;
  const cta = locked ? "VIP Members Only" : met ? "Batch Met · Re-pour" : "Commit to Batch →";

  return (
    <button
      className="mo-card"
      onClick={onOpen}
      style={{
        textAlign: "left",
        background: "#101015",
        border: "1px solid #1f1f27",
        cursor: "pointer",
        padding: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ position: "relative", height: 230, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(158deg, ${shade(frag.liquid, 0.22)} 0%, ${frag.liquid} 46%, ${shade(
              frag.liquid,
              -0.5,
            )} 100%)`,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,0.16), transparent 55%)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "34%",
            top: 0,
            bottom: 0,
            width: 14,
            background: "linear-gradient(90deg, rgba(255,255,255,0.22), transparent)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: 20,
            background: "linear-gradient(0deg, rgba(8,8,10,0.7), transparent)",
          }}
        >
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 27, fontWeight: 700, lineHeight: 1.05, color: "#f6efe0" }}>
            {frag.name}
          </div>
        </div>
        {frag.vipOnly && (
          <span
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(11,11,13,0.78)",
              border: "1px solid rgba(201,169,97,0.45)",
              color: "#c9a961",
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              padding: "5px 9px",
              fontFamily: "'Space Mono',monospace",
            }}
          >
            VIP
          </span>
        )}
        {met && (
          <span
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              background: "#c9a961",
              color: "#0b0b0d",
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              padding: "5px 9px",
              fontWeight: 700,
              fontFamily: "'Space Mono',monospace",
            }}
          >
            Batch Met
          </span>
        )}
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        {showInspiration && (
          <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(243,236,220,0.5)" }}>
            {frag.inspiration}
          </div>
        )}
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "rgba(243,236,220,0.6)" }}>{frag.tagline}</p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: "'Space Mono',monospace",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(243,236,220,0.55)",
          }}
        >
          <span style={{ color: "#c9a961" }}>30% Extrait</span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span>50ml</span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span>{money(frag.price)}</span>
        </div>
        <div style={{ marginTop: "auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "'Space Mono',monospace",
              fontSize: 10,
              color: "rgba(243,236,220,0.5)",
              marginBottom: 7,
            }}
          >
            <span>
              {effectiveCommitted} / {frag.moq}
            </span>
            <span style={{ color: "#c9a961" }}>{pct}%</span>
          </div>
          <div style={{ height: 2, background: "#1f1f27" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: GOLD }} />
          </div>
        </div>
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: locked ? "rgba(243,236,220,0.4)" : GOLD,
            fontWeight: 600,
          }}
        >
          {cta}
        </div>
      </div>
    </button>
  );
}
