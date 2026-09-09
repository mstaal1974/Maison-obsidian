import { useState } from "react";
import Logo from "./Logo";
import { Arrow } from "./ui";
import { MONO, SERIF } from "./styles";
import { navigate, paths } from "../lib/route";
import { joinInnerCircle } from "../lib/profile";
import { GOLD, CREAM } from "../lib/data";

const LINKS: { label: string; to: string }[] = [
  { label: "About", to: paths.about },
  { label: "Sustainability", to: paths.about },
  { label: "Journal", to: paths.about },
  { label: "FAQ", to: paths.about },
  { label: "Contact", to: paths.about },
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  return (
    <footer style={{ borderTop: "1px solid #1f1f27", background: "#0b0b0d" }}>
      <div className="mo-footer-grid" style={{ maxWidth: 1400, margin: "0 auto", padding: "22px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28, flexWrap: "wrap" }}>
        <button onClick={() => navigate(paths.home)} style={{ display: "flex", alignItems: "center", gap: 11, background: "none", border: 0, cursor: "pointer", padding: 0 }}>
          <Logo width={18} height={22} />
          <span style={{ textAlign: "left" }}>
            <span style={{ display: "block", fontFamily: SERIF, fontSize: 15, letterSpacing: "0.16em", fontWeight: 600, color: CREAM, lineHeight: 1 }}>MAISON OBSIDIAN</span>
            <span style={{ display: "block", fontFamily: MONO, fontSize: 7.5, letterSpacing: "0.3em", color: GOLD, marginTop: 4, textTransform: "uppercase" }}>Scents for a bolder you</span>
          </span>
        </button>
        <nav style={{ display: "flex", gap: 30, flexWrap: "wrap" }} aria-label="Footer">
          {LINKS.map((l) => (
            <button key={l.label} className="mo-navlink" onClick={() => navigate(l.to)} style={{ background: "none", border: 0, cursor: "pointer", color: "rgba(243,236,220,0.7)", fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase" }}>
              {l.label}
            </button>
          ))}
        </nav>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Express consent to marketing email, recorded with source "footer".
            if (email.trim()) void joinInnerCircle(email, "footer").then((ok) => ok && setJoined(true));
          }}
          style={{ display: "flex", alignItems: "center", gap: 14 }}
        >
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", color: "rgba(243,236,220,0.6)" }}>{joined ? "Welcome to the inner circle. Unsubscribe any time from your account." : "Join our inner circle"}</span>
          {!joined && (
            <label style={{ display: "flex", alignItems: "center", border: "1px solid #2a2a33", height: 38, paddingLeft: 14 }}>
              <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" type="email" style={{ background: "none", border: 0, outline: "none", color: CREAM, fontFamily: MONO, fontSize: 11, width: 170 }} />
              <button type="submit" aria-label="Join" style={{ background: "none", border: 0, color: GOLD, cursor: "pointer", padding: "0 14px", display: "grid", placeItems: "center" }}>
                <Arrow />
              </button>
            </label>
          )}
          <span style={{ display: "flex", gap: 14, marginLeft: 8, color: "rgba(243,236,220,0.7)" }} aria-label="Social">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-label="Instagram"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" /></svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="TikTok"><path d="M14 3c.4 2.5 2 4 4.5 4.3v3c-1.7 0-3.2-.5-4.5-1.4V15a5.5 5.5 0 1 1-5.5-5.5h1v3.2a2.4 2.4 0 1 0 1.5 2.3V3z" /></svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-label="YouTube"><rect x="3" y="6" width="18" height="12" rx="3" /><path d="m10 9 5 3-5 3z" fill="currentColor" /></svg>
          </span>
        </form>
      </div>
      <div style={{ borderTop: "1px solid #141419" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "12px 32px", display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(243,236,220,0.35)" }}>
          <span>© 2026 Maison Obsidian</span>
          <span>One scent. Every part of your day.</span>
        </div>
      </div>
    </footer>
  );
}
