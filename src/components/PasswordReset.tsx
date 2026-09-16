import { useState, type CSSProperties } from "react";
import { GOLD } from "../lib/data";
import type { AuthResult } from "../lib/auth";

interface PasswordResetProps {
  /** Replaces the password on the session the reset link opened. */
  updatePassword: (password: string) => Promise<AuthResult>;
  /** Leave the password as it was — the session stays signed in either way. */
  onDismiss: () => void;
}

const MIN = 6;

/**
 * The second half of a forgotten password. Following the emailed link signs the
 * customer in, but the password behind the account is still the one they could
 * not remember — so the moment Supabase reports a recovery, this asks for the
 * replacement rather than quietly leaving the old one in place.
 */
export default function PasswordReset({ updatePassword, onDismiss }: PasswordResetProps) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < MIN) {
      setError(`Use at least ${MIN} characters.`);
      return;
    }
    if (password !== again) {
      setError("Those two don't match.");
      return;
    }
    setBusy(true);
    const { error: err } = await updatePassword(password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onDismiss();
  };

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
    <div
      className="mo-auth-overlay"
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
        aria-label="Choose a new password"
        style={{ width: "100%", maxWidth: 420, background: "#0b0b0d", border: "1px solid #1f1f27", padding: 28, animation: "moRise 0.3s ease" }}
      >
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "#c9a961" }}>
          Maison Obsidian
        </span>
        <h2 style={{ margin: "14px 0 0", fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 34, color: "#f3ecdc" }}>
          Choose a new password.
        </h2>
        <p style={{ margin: "10px 0 24px", fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.55)" }}>
          You're signed in from the link. Set the password you'll use next time — the old one stays
          in place until you do.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`New password (min ${MIN} characters)`}
            aria-label="New password"
            className="mo-engrave-input"
            style={input}
          />
          <input
            type="password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder="Type it again"
            aria-label="Repeat new password"
            className="mo-engrave-input"
            style={input}
          />
        </div>

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
          {busy ? "One moment…" : "Save my password"}
        </button>

        <button
          onClick={onDismiss}
          style={{ marginTop: 14, width: "100%", background: "none", border: 0, padding: 0, cursor: "pointer", color: "rgba(243,236,220,0.5)", fontFamily: "'Space Mono',monospace", fontSize: 10.5, letterSpacing: "0.1em" }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
