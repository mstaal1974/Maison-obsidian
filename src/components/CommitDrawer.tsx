import { type Fragrance, GOLD, money } from "../lib/data";

interface CommitDrawerProps {
  lastCommit: Fragrance | null;
  effectiveCommitted: number;
  engraving: string | null;
  sizeMl?: number;
  chargeCents?: number;
  hasCommits: boolean;
  showInspiration: boolean;
  onClose: () => void;
  onToVault: () => void;
}

export default function CommitDrawer({
  lastCommit,
  effectiveCommitted,
  engraving,
  sizeMl,
  chargeCents,
  hasCommits,
  showInspiration,
  onClose,
  onToVault,
}: CommitDrawerProps) {
  const pct = lastCommit ? Math.min(100, Math.round((effectiveCommitted / lastCommit.moq) * 100)) : 0;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          background: "rgba(5,5,7,0.7)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          animation: "moFade 0.25s ease",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 91,
          width: 420,
          maxWidth: "92vw",
          background: "#0d0d11",
          borderLeft: "1px solid #1f1f27",
          animation: "moDrawer 0.32s ease",
          display: "flex",
          flexDirection: "column",
        }}
        role="dialog"
        aria-label="Your commits"
      >
        <div
          style={{
            padding: "24px 28px",
            borderBottom: "1px solid #1f1f27",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: "'Space Mono',monospace",
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "#c9a961",
            }}
          >
            Your Commits
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: 0, cursor: "pointer", color: "rgba(243,236,220,0.6)", fontSize: 20, lineHeight: 1 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mo-scroll" style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          {lastCommit ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 11, color: "#c9a961" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <circle cx="10" cy="10" r="9" stroke="#c9a961" strokeWidth="1.1" />
                  <path d="M6 10l2.6 2.6L14 7" stroke="#c9a961" strokeWidth="1.4" />
                </svg>
                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: "#f3ecdc" }}>Reserved.</span>
              </div>
              <div style={{ marginTop: 22, border: "1px solid #1f1f27", padding: 22 }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, color: "#f3ecdc" }}>{lastCommit.name}</div>
                {showInspiration && (
                  <div
                    style={{
                      marginTop: 5,
                      fontSize: 10,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "rgba(243,236,220,0.45)",
                    }}
                  >
                    {lastCommit.inspiration}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontFamily: "'Space Mono',monospace",
                    fontSize: 10,
                    color: "rgba(243,236,220,0.55)",
                  }}
                >
                  <span>
                    {effectiveCommitted} / {lastCommit.moq} committed
                  </span>
                  <span style={{ color: "#c9a961" }}>{pct}%</span>
                </div>
                <div style={{ marginTop: 9, height: 3, background: "#1f1f27" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: GOLD }} />
                </div>
                {sizeMl && (
                  <div
                    style={{
                      marginTop: 18,
                      paddingTop: 16,
                      borderTop: "1px solid #1f1f27",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontFamily: "'Space Mono',monospace",
                      fontSize: 11,
                      color: "rgba(243,236,220,0.6)",
                    }}
                  >
                    <span style={{ letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 9, color: "rgba(243,236,220,0.45)" }}>
                      Size
                    </span>
                    <span>
                      {sizeMl} ml{chargeCents != null ? ` · ${money(chargeCents)}` : ""}
                    </span>
                  </div>
                )}
                {engraving && (
                  <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #1f1f27" }}>
                    <div
                      style={{
                        fontFamily: "'Space Mono',monospace",
                        fontSize: 9,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: "rgba(243,236,220,0.45)",
                      }}
                    >
                      Engraving
                    </div>
                    <div style={{ marginTop: 6, fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontSize: 18, color: "#c9a961" }}>
                      {engraving}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 18, display: "flex", gap: 11, color: "#c9a961", alignItems: "flex-start" }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden>
                  <rect x="1.5" y="3.5" width="13" height="9" rx="1" stroke="#c9a961" strokeWidth="1.1" />
                  <path d="M1.5 6.5h13" stroke="#c9a961" strokeWidth="1.1" />
                </svg>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "rgba(243,236,220,0.6)" }}>
                  Card <span style={{ color: "#c9a961" }}>authorized — not charged</span>. We capture only when this batch is
                  met, then your bottle ships engraved.
                </p>
              </div>
            </>
          ) : (
            !hasCommits && (
              <div style={{ padding: "60px 0", textAlign: "center" }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: "rgba(243,236,220,0.7)" }}>
                  No commits yet.
                </div>
                <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "rgba(243,236,220,0.5)" }}>
                  Reserve a spot in a batch and it will appear here.
                </p>
                <button
                  className="mo-cta"
                  onClick={onToVault}
                  style={{
                    marginTop: 24,
                    background: "#c9a961",
                    color: "#0b0b0d",
                    border: 0,
                    cursor: "pointer",
                    height: 44,
                    padding: "0 24px",
                    fontSize: 10.5,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  Enter the Vault
                </button>
              </div>
            )
          )}
        </div>
      </aside>
    </>
  );
}
