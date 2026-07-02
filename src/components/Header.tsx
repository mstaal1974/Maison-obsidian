import { type CSSProperties, useState } from "react";
import Logo from "./Logo";

interface HeaderProps {
  commitCount: string;
  userEmail: string | null;
  onBackHome: () => void;
  onGoVault: () => void;
  onGoMethod: () => void;
  onGoVip: () => void;
  onOpenDrawer: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onGoAccount: () => void;
}

const navLink: CSSProperties = {
  background: "none",
  border: 0,
  cursor: "pointer",
  color: "rgba(243,236,220,0.66)",
  fontSize: 11,
  letterSpacing: "0.26em",
  textTransform: "uppercase",
  fontWeight: 500,
};

export default function Header({
  commitCount,
  userEmail,
  onBackHome,
  onGoVault,
  onGoMethod,
  onGoVip,
  onOpenDrawer,
  onSignIn,
  onSignOut,
  onGoAccount,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(11,11,13,0.82)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid #1f1f27",
      }}
    >
      <div
        style={{
          maxWidth: 1340,
          margin: "0 auto",
          padding: "0 32px",
          height: 74,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <button
          onClick={onBackHome}
          style={{ display: "flex", alignItems: "center", gap: 13, background: "none", border: 0, cursor: "pointer", padding: 0 }}
        >
          <Logo />
          <span style={{ display: "block", textAlign: "left" }}>
            <span
              style={{
                display: "block",
                fontFamily: "'Cormorant Garamond',serif",
                fontSize: 19,
                letterSpacing: "0.14em",
                fontWeight: 600,
                lineHeight: 1,
                color: "#f3ecdc",
              }}
            >
              MAISON OBSIDIAN
            </span>
            <span
              style={{
                display: "block",
                fontFamily: "'Space Mono',monospace",
                fontSize: 9,
                letterSpacing: "0.34em",
                color: "#c9a961",
                marginTop: 4,
                textTransform: "uppercase",
              }}
            >
              Boutique Laboratory
            </span>
          </span>
        </button>

        <nav style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <button className="mo-navlink" onClick={onGoVault} style={navLink}>
            The Vault
          </button>
          <button className="mo-navlink" onClick={onGoMethod} style={navLink}>
            The Method
          </button>
          <button className="mo-navlink" onClick={onGoVip} style={navLink}>
            VIP Club
          </button>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            className="mo-pill"
            onClick={onOpenDrawer}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              border: "1px solid #1f1f27",
              height: 40,
              padding: "0 15px",
              background: "none",
              color: "#f3ecdc",
              cursor: "pointer",
            }}
            aria-label="Open your commits"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="5.3" stroke="#c9a961" strokeWidth="1.1" />
              <circle cx="7" cy="7" r="1.4" fill="#c9a961" />
            </svg>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, color: "#f3ecdc" }}>{commitCount}</span>
          </button>
          {userEmail ? (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                style={{
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                  color: "#c9a961",
                  fontSize: 11,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Account
              </button>
              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <div
                    role="menu"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 14px)",
                      right: 0,
                      zIndex: 41,
                      minWidth: 220,
                      background: "#0d0d11",
                      border: "1px solid #1f1f27",
                      padding: 16,
                    }}
                  >
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(243,236,220,0.4)" }}>
                      Signed in as
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, color: "#f3ecdc", wordBreak: "break-all" }}>{userEmail}</div>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onGoAccount();
                      }}
                      className="mo-ghost"
                      style={{
                        marginTop: 16,
                        width: "100%",
                        background: "none",
                        border: "1px solid #1f1f27",
                        cursor: "pointer",
                        height: 38,
                        color: "rgba(243,236,220,0.75)",
                        fontSize: 10,
                        letterSpacing: "0.24em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                      }}
                    >
                      My Reservations
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onSignOut();
                      }}
                      className="mo-ghost"
                      style={{
                        marginTop: 16,
                        width: "100%",
                        background: "none",
                        border: "1px solid #1f1f27",
                        cursor: "pointer",
                        height: 38,
                        color: "rgba(243,236,220,0.75)",
                        fontSize: 10,
                        letterSpacing: "0.24em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={onSignIn}
              style={{
                background: "none",
                border: 0,
                cursor: "pointer",
                color: "#c9a961",
                fontSize: 11,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
