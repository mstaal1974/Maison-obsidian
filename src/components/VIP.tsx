import { GOLD } from "../lib/data";

interface VIPProps {
  vip: boolean;
  signedIn: boolean;
  onJoin: () => void;
}

const PERKS = [
  { title: "→ Early access", body: "Shop VIP-only releases before they open to everyone." },
  { title: "→ Re-pour priority", body: "First claim when a sold-out scent returns." },
  { title: "→ Free engraving", body: "Complimentary on every bottle, always." },
];

export default function VIP({ vip, signedIn, onJoin }: VIPProps) {
  return (
    <section id="mo-vip" style={{ maxWidth: 1340, margin: "0 auto", padding: "84px 32px" }}>
      <div
        style={{
          border: "1px solid rgba(201,169,97,0.35)",
          padding: 56,
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, rgba(201,169,97,0.06), transparent 60%)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 56, alignItems: "center" }} className="mo-vip-grid">
          <div>
            <div
              style={{
                fontFamily: "'Space Mono',monospace",
                fontSize: 10,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "#c9a961",
              }}
            >
              Membership · By Invitation
            </div>
            <h2
              style={{
                margin: "16px 0 0",
                fontFamily: "'Cormorant Garamond',serif",
                fontWeight: 300,
                fontSize: 48,
                color: "#f3ecdc",
                lineHeight: 1.05,
              }}
            >
              The VIP Club
            </h2>
            <p style={{ margin: "18px 0 0", maxWidth: 460, fontSize: 14, lineHeight: 1.7, color: "rgba(243,236,220,0.62)" }}>
              Early access to locked releases, first claim on re-pours of sold-out scents, and a complimentary engraving on
              every order. Members shape what the lab pours next.
            </p>
            <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 18 }}>
              {vip ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    background: GOLD,
                    color: "#0b0b0d",
                    height: 48,
                    padding: "0 28px",
                    fontSize: 11,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  ✓ You're a Member
                </span>
              ) : (
                <button
                  onClick={onJoin}
                  style={{
                    background: "transparent",
                    color: GOLD,
                    border: "1px solid #c9a961",
                    cursor: "pointer",
                    height: 48,
                    padding: "0 28px",
                    fontSize: 11,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {signedIn ? "Join the VIP Club" : "Sign In to Join"}
                </button>
              )}
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "rgba(243,236,220,0.45)" }}>
                $120 / year
              </span>
            </div>
          </div>
          <div style={{ display: "grid", gap: 1, background: "#1f1f27", border: "1px solid #1f1f27" }}>
            {PERKS.map((p) => (
              <div key={p.title} style={{ background: "#0d0d11", padding: "20px 22px" }}>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#c9a961" }}>{p.title}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "rgba(243,236,220,0.55)" }}>{p.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
