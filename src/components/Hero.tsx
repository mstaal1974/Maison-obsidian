interface HeroProps {
  onGoVault: () => void;
  onGoMethod: () => void;
}

function Stat({ value, label, first }: { value: string; label: string; first?: boolean }) {
  return (
    <div
      style={{
        padding: first ? "22px 18px 4px 0" : "22px 18px 4px",
        borderLeft: first ? undefined : "1px solid #1f1f27",
      }}
    >
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 26, color: "#c9a961", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div
        style={{
          marginTop: 7,
          fontSize: 9.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(243,236,220,0.5)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default function Hero({ onGoVault, onGoMethod }: HeroProps) {
  return (
    <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid #1f1f27" }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "radial-gradient(55% 50% at 70% 22%, rgba(201,169,97,0.09), transparent 70%)",
        }}
      />
      <div
        style={{
          position: "relative",
          maxWidth: 1340,
          margin: "0 auto",
          padding: "0 32px",
          display: "grid",
          gridTemplateColumns: "1.08fr 0.92fr",
          gap: 64,
          alignItems: "center",
          minHeight: 600,
        }}
        className="mo-hero-grid"
      >
        <div style={{ padding: "76px 0" }} className="mo-rise">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              border: "1px solid rgba(201,169,97,0.32)",
              padding: "7px 13px",
              fontFamily: "'Space Mono',monospace",
              fontSize: 10,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: "#c9a961",
            }}
          >
            <span style={{ width: 5, height: 5, background: "#c9a961", borderRadius: "50%", display: "inline-block" }} />
            Batch Atelier · Est. 2026
          </div>
          <h1
            style={{
              margin: "30px 0 0",
              fontFamily: "'Cormorant Garamond',serif",
              fontWeight: 300,
              fontSize: 74,
              lineHeight: 1.02,
              letterSpacing: "-0.01em",
              color: "#f3ecdc",
            }}
          >
            Fragrance, distilled
            <br />
            by <span style={{ fontStyle: "italic", color: "#c9a961", fontWeight: 400 }}>small numbers.</span>
          </h1>
          <p
            style={{
              margin: "28px 0 0",
              maxWidth: 480,
              fontSize: 15,
              lineHeight: 1.7,
              color: "rgba(243,236,220,0.62)",
            }}
          >
            We pour each scent in batches of twenty — thirty percent oil, Dubai-sourced absolutes, macerated four full
            weeks. You don't pay until your batch is met. Then the lab opens, and your bottle ships engraved with your
            name.
          </p>
          <div style={{ margin: "38px 0 0", display: "flex", alignItems: "center", gap: 22 }}>
            <button
              className="mo-cta"
              onClick={onGoVault}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "#c9a961",
                color: "#0b0b0d",
                border: 0,
                cursor: "pointer",
                height: 50,
                padding: "0 26px",
                fontSize: 11,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Enter the Vault
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
                <path d="M1 6h13M9 1l5 5-5 5" stroke="#0b0b0d" strokeWidth="1.4" />
              </svg>
            </button>
            <button
              className="mo-ghost"
              onClick={onGoMethod}
              style={{
                background: "none",
                border: 0,
                borderBottom: "1px solid rgba(243,236,220,0.22)",
                cursor: "pointer",
                color: "rgba(243,236,220,0.72)",
                fontSize: 11,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                fontWeight: 500,
                padding: "0 0 5px",
              }}
            >
              The Method
            </button>
          </div>
          <div
            style={{
              margin: "54px 0 0",
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              borderTop: "1px solid #1f1f27",
            }}
          >
            <Stat value="30%" label="Oil conc." first />
            <Stat value="4wk" label="Macerate" />
            <Stat value="20" label="Per batch" />
            <Stat value="DXB" label="Sourced" />
          </div>
        </div>

        <div style={{ position: "relative", padding: "48px 0" }} className="mo-rise">
          <div style={{ position: "relative", border: "1px solid #1f1f27", padding: 14, background: "#0e0e12" }}>
            <picture>
              <source srcSet="/assets/bottle-portrait.webp" type="image/webp" />
              <img
                src="/assets/bottle-portrait.png"
                alt="Maison Obsidian house bottle"
                width={1200}
                height={1310}
                decoding="async"
                style={{ display: "block", width: "100%", height: "auto" }}
              />
            </picture>
            <div
              style={{
                position: "absolute",
                top: 24,
                left: 24,
                fontFamily: "'Space Mono',monospace",
                fontSize: 9.5,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "rgba(243,236,220,0.5)",
              }}
            >
              Obsidian No.1
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 26,
                right: 26,
                textAlign: "right",
                fontFamily: "'Space Mono',monospace",
                fontSize: 9.5,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#c9a961",
              }}
            >
              30% Extrait · 50ml
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: "'Space Mono',monospace",
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(243,236,220,0.45)",
            }}
          >
            <span>Fig.01 — House Bottle</span>
            <span>Amber glass · walnut cap</span>
          </div>
        </div>
      </div>
    </section>
  );
}
