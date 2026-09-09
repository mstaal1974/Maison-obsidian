import { useState, type CSSProperties } from "react";
import { GOLD } from "../lib/data";
import type { AuthResult } from "../lib/auth";

interface AuthModalProps {
  configured: boolean;
  /** When set ("checkout" | "subscribe"), the modal explains why sign-in is required. */
  reason?: string | null;
  onClose: () => void;
  /** Fired once, after authentication succeeds — before onClose — with the email used. */
  onAuthed?: (email: string) => void;
  /** Sign-up only: the consents the person ticked (both default off). */
  onConsents?: (c: { marketing: boolean; ai: boolean }) => void;
  signInEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpEmail: (email: string, password: string) => Promise<AuthResult>;
  signInGoogle: () => Promise<AuthResult>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthModal({
  configured,
  reason,
  onClose,
  onAuthed,
  onConsents,
  signInEmail,
  signUpEmail,
  signInGoogle,
}: AuthModalProps) {
  // A reservation attempt lands new visitors on the sign-up tab by default.
  const [mode, setMode] = useState<"signin" | "signup">(reason === "checkout" || reason === "subscribe" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Consent is opt-in: nothing is ticked until the person ticks it.
  const [marketing, setMarketing] = useState(false);
  const [ai, setAi] = useState(false);

  const valid = EMAIL_RE.test(email.trim()) && password.length >= 6;

  const submit = async () => {
    setError(null);
    if (!valid) {
      setError("Enter a valid email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    const { error: err } = mode === "signin" ? await signInEmail(email, password) : await signUpEmail(email, password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    if (mode === "signup") onConsents?.({ marketing, ai });
    onAuthed?.(email.trim());
    onClose();
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await signInGoogle();
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    // Real Supabase Google sign-in redirects away; the demo resolves inline.
    if (!configured) {
      onAuthed?.("");
      onClose();
    }
  };

  const tab = (active: boolean): CSSProperties => ({
    flex: 1,
    background: "none",
    border: 0,
    borderBottom: active ? "1px solid #c9a961" : "1px solid #1f1f27",
    cursor: "pointer",
    padding: "0 0 12px",
    color: active ? "#c9a961" : "rgba(243,236,220,0.55)",
    fontSize: 11,
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    fontWeight: 600,
  });

  const input: CSSProperties = {
    width: "100%",
    background: "none",
    border: "1px solid #1f1f27",
    outline: "none",
    height: 48,
    padding: "0 16px",
    color: "#f3ecdc",
    fontFamily: "'Space Mono',monospace",
    fontSize: 13,
  };

  return (
    // The overlay is the scroll container: the dialog is flex-centred inside
    // it (not transform-centred, which the moRise animation would override)
    // and scrolls within the viewport when it is taller than the screen.
    <div
      className="mo-auth-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
        background: "rgba(5,5,7,0.7)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        animation: "moFade 0.25s ease",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
        className="mo-auth-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: "100%",
          maxHeight: "100%",
          overflowY: "auto",
          margin: "auto",
          flex: "none",
          boxSizing: "border-box",
          background: "#0d0d11",
          border: "1px solid #1f1f27",
          animation: "moRise 0.3s ease both",
          padding: 32,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontFamily: "'Space Mono',monospace",
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "#c9a961",
            }}
          >
            Maison Obsidian
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: 0, cursor: "pointer", color: "rgba(243,236,220,0.6)", fontSize: 20, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <h2 className="mo-auth-title" style={{ margin: "14px 0 0", fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 34, color: "#f3ecdc" }}>
          {reason === "checkout"
            ? mode === "signin"
              ? "Sign in to check out."
              : "Join to check out."
            : reason === "subscribe"
              ? mode === "signin"
                ? "Sign in to subscribe."
                : "Join the Monthly Pour."
              : mode === "signin"
                ? "Welcome back."
                : "Create your account."}
        </h2>
        {reason === "checkout" ? (
          <p style={{ margin: "10px 0 24px", fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.55)" }}>
            Your orders live under your account, with tracking for every parcel. Sign in or create one to check out — your bag picks up right where you left off.
          </p>
        ) : reason === "subscribe" ? (
          <p style={{ margin: "10px 0 24px", fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.55)" }}>
            Your subscription lives under your account: that's where you choose next month's scent, follow deliveries and cancel. Sign in or create one to start.
          </p>
        ) : (
          <div style={{ height: 24 }} />
        )}

        <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
          <button onClick={() => { setMode("signin"); setError(null); }} style={tab(mode === "signin")}>
            Sign In
          </button>
          <button onClick={() => { setMode("signup"); setError(null); }} style={tab(mode === "signup")}>
            Sign Up
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email"
            className="mo-engrave-input"
            style={input}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder="Password (min 6 characters)"
            aria-label="Password"
            className="mo-engrave-input"
            style={input}
          />
        </div>

        {mode === "signup" && (
          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            {(
              [
                { key: "marketing", on: marketing, set: setMarketing, label: "Email me about new releases and offers.", hint: "A note when a scent you might like lands. Unsubscribe any time from your account." },
                { key: "ai", on: ai, set: setAi, label: "Personalise suggestions from my history.", hint: "The concierge and Monthly Pour surprises can use what you've bought and asked for." },
              ] as { key: string; on: boolean; set: (v: boolean) => void; label: string; hint: string }[]
            ).map((c) => (
              <label key={c.key} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 10, alignItems: "start", cursor: "pointer" }}>
                <input type="checkbox" checked={c.on} onChange={(e) => c.set(e.target.checked)} aria-label={c.label} style={{ marginTop: 2, accentColor: "#c9a961" }} />
                <span>
                  <span style={{ display: "block", fontSize: 12.5, color: "#f3ecdc", lineHeight: 1.4 }}>{c.label}</span>
                  <span style={{ display: "block", fontSize: 11, color: "rgba(243,236,220,0.5)", lineHeight: 1.5 }}>{c.hint}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {error && <div style={{ marginTop: 12, fontSize: 11.5, lineHeight: 1.5, color: "#d98a6a" }}>{error}</div>}

        <button
          onClick={() => void submit()}
          disabled={busy}
          className="mo-cta"
          style={{
            marginTop: 18,
            width: "100%",
            height: 50,
            background: GOLD,
            color: "#0b0b0d",
            border: 0,
            cursor: busy ? "default" : "pointer",
            fontSize: 11,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            fontWeight: 600,
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "One moment…" : mode === "signin" ? "Sign In" : "Create Account"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "22px 0" }}>
          <span style={{ flex: 1, height: 1, background: "#1f1f27" }} />
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(243,236,220,0.4)" }}>
            or
          </span>
          <span style={{ flex: 1, height: 1, background: "#1f1f27" }} />
        </div>

        <button
          onClick={() => void google()}
          disabled={busy}
          className="mo-pill"
          style={{
            width: "100%",
            height: 50,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 11,
            background: "none",
            border: "1px solid #1f1f27",
            cursor: busy ? "default" : "pointer",
            color: "#f3ecdc",
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
          Continue with Google
        </button>

        {!configured && (
          <p style={{ margin: "18px 0 0", fontSize: 10.5, lineHeight: 1.6, color: "rgba(243,236,220,0.4)", textAlign: "center" }}>
            Demo mode — Supabase isn't configured, so any credentials sign you in locally.
          </p>
        )}
      </div>
    </div>
  );
}
