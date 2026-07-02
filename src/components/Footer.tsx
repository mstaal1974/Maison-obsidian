import Logo from "./Logo";

const COLUMNS = [
  { title: "Shop", links: ["The Vault", "Sample Box", "Gift Cards", "Subscriptions"] },
  { title: "House", links: ["The Method", "VIP Club", "Journal", "Contact"] },
  { title: "Care", links: ["Shipping", "Returns", "FAQ", "Terms"] },
];

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid #1f1f27", background: "#0d0d11" }}>
      <div
        style={{
          maxWidth: 1340,
          margin: "0 auto",
          padding: "60px 32px 40px",
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
          gap: 40,
        }}
        className="mo-footer-grid"
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Logo width={18} height={22} />
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, letterSpacing: "0.12em", fontWeight: 600 }}>
              MAISON OBSIDIAN
            </span>
          </div>
          <p style={{ margin: "18px 0 0", maxWidth: 300, fontSize: 12.5, lineHeight: 1.7, color: "rgba(243,236,220,0.5)" }}>
            A boutique batch laboratory. We pour in small numbers so every bottle is met, never mass-produced.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div
              style={{
                fontFamily: "'Space Mono',monospace",
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#c9a961",
              }}
            >
              {col.title}
            </div>
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: 11,
                fontSize: 12.5,
                color: "rgba(243,236,220,0.55)",
              }}
            >
              {col.links.map((l) => (
                <span key={l} className="mo-link">
                  {l}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid #1f1f27" }}>
        <div
          style={{
            maxWidth: 1340,
            margin: "0 auto",
            padding: "20px 32px",
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "'Space Mono',monospace",
            fontSize: 9.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(243,236,220,0.35)",
          }}
        >
          <span>© 2026 Maison Obsidian</span>
          <span>Poured in small numbers · DXB</span>
        </div>
      </div>
    </footer>
  );
}
