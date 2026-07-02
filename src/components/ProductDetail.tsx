import { type CSSProperties, useState } from "react";
import { type Fragrance, GOLD, money } from "../lib/data";

interface ProductDetailProps {
  frag: Fragrance;
  effectiveCommitted: number;
  vip: boolean;
  showInspiration: boolean;
  committedHere: boolean;
  onBack: () => void;
  /** Called with the engraving, chosen size (ml) and price held (cents) on commit. */
  onCommit: (engraving: string | null, sizeMl: number, chargeCents: number) => void;
}

export default function ProductDetail({
  frag,
  effectiveCommitted,
  vip,
  showInspiration,
  committedHere,
  onBack,
  onCommit,
}: ProductDetailProps) {
  // Engraving + size are scoped to this product view; App remounts via `key={slug}`.
  const [engraveOn, setEngraveOn] = useState(false);
  const [engraveLabel, setEngraveLabel] = useState("");
  const [sizeMl, setSizeMl] = useState<10 | 30 | 50>(50);

  const sizes: { ml: 10 | 30 | 50; cents: number }[] = [
    { ml: 10, cents: frag.price10 },
    { ml: 30, cents: frag.price30 },
    { ml: 50, cents: frag.price },
  ];
  const selectedPrice = sizes.find((s) => s.ml === sizeMl)?.cents ?? frag.price;

  const onToggleEngrave = () => setEngraveOn((v) => !v);
  const onLabel = (value: string) => {
    setEngraveLabel(value.slice(0, 28));
    setEngraveOn(true);
  };

  const pct = Math.min(100, Math.round((effectiveCommitted / frag.moq) * 100));
  const met = effectiveCommitted >= frag.moq;
  const locked = !!frag.vipOnly && !vip;
  const previewLabel = engraveOn ? engraveLabel.trim() : "";
  const hasEngraving = previewLabel.length > 0;

  const batchNote = met
    ? "Batch met — the lab is open, bottles are filling now."
    : `${frag.moq - effectiveCommitted} more commits until this batch pours.`;

  const commitBg = locked || committedHere ? "#1f1f27" : GOLD;
  const commitColor = locked || committedHere ? "rgba(243,236,220,0.5)" : "#0b0b0d";
  const commitLabel = locked
    ? "VIP Members Only"
    : committedHere
      ? "✓ Committed — card authorized"
      : `Commit to this Batch · ${money(selectedPrice)}`;

  const cell: CSSProperties = { padding: "18px 20px" };
  const cellLabel: CSSProperties = {
    fontSize: 9.5,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "rgba(243,236,220,0.45)",
  };
  const cellValue: CSSProperties = {
    marginTop: 7,
    fontFamily: "'Space Mono',monospace",
    fontSize: 16,
    color: "#c9a961",
  };

  const compRow = (last = false): CSSProperties => ({
    display: "grid",
    gridTemplateColumns: "90px 1fr",
    gap: 16,
    padding: "14px 0",
    borderTop: "1px solid #1f1f27",
    borderBottom: last ? "1px solid #1f1f27" : undefined,
  });

  return (
    <main data-screen-label="Product" style={{ maxWidth: 1340, margin: "0 auto", padding: "36px 32px 90px" }}>
      <button
        className="mo-ghost"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          background: "none",
          border: 0,
          cursor: "pointer",
          color: "rgba(243,236,220,0.6)",
          fontSize: 11,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden>
          <path d="M14 5.5H1M6 1L1 5.5 6 10" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        Back to the Vault
      </button>

      <div
        style={{ marginTop: 30, display: "grid", gridTemplateColumns: "0.92fr 1.08fr", gap: 72 }}
        className="mo-pdp-grid"
      >
        {/* BOTTLE */}
        <div>
          <div
            style={{
              position: "relative",
              border: "1px solid #1f1f27",
              background: "#0e0e12",
              overflow: "hidden",
              containerType: "inline-size",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(60% 50% at 50% 62%, ${frag.accent}26, transparent 66%)`,
              }}
            />
            <img
              src="/assets/bottle-pdp.jpg"
              alt={`${frag.name} bottle`}
              style={{ display: "block", width: "100%", height: "auto", position: "relative" }}
            />
            <div
              style={{
                position: "absolute",
                left: "51.5%",
                top: "60.6%",
                width: "25%",
                transform: "translate(-50%,-50%)",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  fontFamily: "'Cormorant Garamond',serif",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  lineHeight: 1.08,
                  color: "#c3a263",
                  fontSize: "clamp(8px,2.6cqw,16px)",
                  textShadow: "0 1px 1px rgba(0,0,0,0.55),0 0 1px rgba(0,0,0,0.45)",
                }}
              >
                {frag.name}
              </div>
            </div>
          </div>
          <p
            style={{
              margin: "14px 0 0",
              textAlign: "center",
              fontFamily: "'Space Mono',monospace",
              fontSize: 9.5,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(243,236,220,0.4)",
            }}
          >
            Live preview · engraving updates as you type
          </p>
          {hasEngraving && (
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <span
                style={{
                  display: "inline-block",
                  border: "1px solid rgba(201,169,97,0.4)",
                  background: "rgba(201,169,97,0.05)",
                  padding: "9px 20px",
                  fontFamily: "'Cormorant Garamond',serif",
                  fontStyle: "italic",
                  fontSize: 19,
                  color: "#c9a961",
                }}
              >
                “{previewLabel}”
              </span>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: "'Space Mono',monospace",
                  fontSize: 8.5,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "rgba(243,236,220,0.4)",
                }}
              >
                Engraved on your bottle
              </div>
            </div>
          )}
        </div>

        {/* DETAILS */}
        <div>
          {showInspiration && (
            <div
              style={{
                fontFamily: "'Space Mono',monospace",
                fontSize: 10,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color: "rgba(201,169,97,0.85)",
              }}
            >
              {frag.inspiration}
            </div>
          )}
          <h1
            style={{
              margin: "12px 0 0",
              fontFamily: "'Cormorant Garamond',serif",
              fontWeight: 300,
              fontSize: 62,
              lineHeight: 1.0,
              color: "#f3ecdc",
            }}
          >
            {frag.name}
          </h1>
          <p style={{ margin: "22px 0 0", maxWidth: 520, fontSize: 15, lineHeight: 1.75, color: "rgba(243,236,220,0.64)" }}>
            {frag.story}
          </p>

          <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(3,1fr)", border: "1px solid #1f1f27" }}>
            <div style={cell}>
              <div style={cellLabel}>Concentration</div>
              <div style={cellValue}>30% Extrait</div>
            </div>
            <div style={{ ...cell, borderLeft: "1px solid #1f1f27" }}>
              <div style={cellLabel}>Volume</div>
              <div style={cellValue}>{sizeMl} ml</div>
            </div>
            <div style={{ ...cell, borderLeft: "1px solid #1f1f27" }}>
              <div style={cellLabel}>Price</div>
              <div style={cellValue}>{money(selectedPrice)}</div>
            </div>
          </div>

          {/* SIZE SELECTOR */}
          <div style={{ marginTop: 22 }}>
            <div
              style={{
                fontFamily: "'Space Mono',monospace",
                fontSize: 10,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color: "rgba(243,236,220,0.5)",
                marginBottom: 12,
              }}
            >
              Select Size
            </div>
            <div role="radiogroup" aria-label="Bottle size" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {sizes.map((s) => {
                const active = s.ml === sizeMl;
                return (
                  <button
                    key={s.ml}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSizeMl(s.ml)}
                    className="mo-pill"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 6,
                      padding: "14px 16px",
                      cursor: "pointer",
                      background: active ? "rgba(201,169,97,0.08)" : "none",
                      border: active ? "1px solid #c9a961" : "1px solid #1f1f27",
                      color: "#f3ecdc",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: active ? "#c9a961" : "#f3ecdc" }}>
                      {s.ml} ml
                    </span>
                    <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, color: "rgba(243,236,220,0.6)" }}>
                      {money(s.cents)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* COMPOSITION */}
          <div style={{ marginTop: 34 }}>
            <div
              style={{
                fontFamily: "'Space Mono',monospace",
                fontSize: 10,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color: "rgba(243,236,220,0.5)",
              }}
            >
              Composition
            </div>
            <div style={{ marginTop: 14 }}>
              {(
                [
                  ["Top", frag.top],
                  ["Heart", frag.heart],
                  ["Base", frag.base],
                ] as const
              ).map(([label, notes], i, arr) => (
                <div key={label} style={compRow(i === arr.length - 1)}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontSize: 15, color: "rgba(243,236,220,0.6)" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 13.5, color: "#f3ecdc", lineHeight: 1.7 }}>{notes.join("  ·  ")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ENGRAVING ENGINE */}
          <div style={{ marginTop: 30, border: "1px solid #1f1f27", background: "rgba(20,20,26,0.4)", padding: 26 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#c9a961" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path
                      d="M7 1l1.5 4L13 6.5 8.5 8 7 13 5.5 8 1 6.5 5.5 5z"
                      stroke="#c9a961"
                      strokeWidth="1.1"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>
                    Custom Engraving
                  </span>
                </div>
                <h3 style={{ margin: "12px 0 0", fontFamily: "'Cormorant Garamond',serif", fontSize: 23, color: "#f3ecdc" }}>
                  Engrave a name, a date, a secret.
                </h3>
                <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "rgba(243,236,220,0.52)" }}>
                  Hand-set onto the label panel. Up to 28 characters.
                </p>
              </div>
              <button
                onClick={onToggleEngrave}
                aria-pressed={engraveOn}
                style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 9, background: "none", border: 0, cursor: "pointer" }}
              >
                <span
                  style={{
                    position: "relative",
                    width: 38,
                    height: 20,
                    background: engraveOn ? GOLD : "#1f1f27",
                    transition: "background 0.2s",
                    display: "inline-block",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: 2,
                      width: 16,
                      height: 16,
                      background: "#f3ecdc",
                      transform: engraveOn ? "translateX(18px)" : "translateX(0)",
                      transition: "transform 0.2s",
                      display: "block",
                    }}
                  />
                </span>
                <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(243,236,220,0.7)" }}>
                  {engraveOn ? "On" : "Off"}
                </span>
              </button>
            </div>
            <div style={{ marginTop: 20 }}>
              <input
                className="mo-engrave-input"
                type="text"
                value={engraveLabel}
                onChange={(e) => onLabel(e.target.value)}
                maxLength={28}
                placeholder="e.g. Happy Birthday, John"
                style={{
                  width: "100%",
                  background: "none",
                  border: 0,
                  borderBottom: "1px solid #1f1f27",
                  outline: "none",
                  padding: "11px 0",
                  color: "#f3ecdc",
                  fontFamily: "'Cormorant Garamond',serif",
                  fontSize: 18,
                }}
              />
              <div
                style={{
                  marginTop: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "'Space Mono',monospace",
                  fontSize: 9.5,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(243,236,220,0.42)",
                }}
              >
                <span>{engraveOn ? "Preview is live →" : "Toggle on to engrave"}</span>
                <span>{engraveLabel.length} / 28</span>
              </div>
            </div>
          </div>

          {/* BATCH + COMMIT */}
          <div style={{ marginTop: 30 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: "'Space Mono',monospace",
                fontSize: 11,
                letterSpacing: "0.06em",
                color: "rgba(243,236,220,0.6)",
              }}
            >
              <span>
                BATCH PROGRESS — {effectiveCommitted} / {frag.moq} committed
              </span>
              <span style={{ color: "#c9a961" }}>{pct}%</span>
            </div>
            <div style={{ marginTop: 10, height: 3, background: "#1f1f27" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: GOLD, transition: "width 0.5s ease" }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 11.5, color: "rgba(243,236,220,0.5)" }}>{batchNote}</div>

            <button
              className="mo-softhover"
              onClick={() => onCommit(hasEngraving ? previewLabel : null, sizeMl, selectedPrice)}
              disabled={locked || committedHere}
              style={{
                marginTop: 24,
                width: "100%",
                height: 58,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 11,
                border: 0,
                cursor: locked || committedHere ? "default" : "pointer",
                fontSize: 11,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                fontWeight: 600,
                background: commitBg,
                color: commitColor,
              }}
            >
              {commitLabel}
            </button>
            <p style={{ margin: "16px 0 0", fontSize: 11.5, lineHeight: 1.65, color: "rgba(243,236,220,0.5)" }}>
              Your card is <span style={{ color: "#c9a961" }}>authorized, never charged</span> today. We capture only when
              the batch reaches {frag.moq} commits. If it closes short, the hold is released — no questions asked.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
