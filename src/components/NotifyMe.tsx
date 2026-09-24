import { useState } from "react";
import { type FormatKey, CREAM, GOLD } from "../lib/data";
import { EMAIL_RE, joinWaitlist } from "../lib/waitlist";
import { btnGold, micro } from "./styles";

interface Props {
  fragranceId: string;
  /** Null: the fragrance's launch. */
  format: FormatKey | null;
  /** The signed-in customer's address, to save typing. */
  defaultEmail?: string | null;
  cta?: string;
  /** What they're signing up for, said plainly under the field. */
  note: string;
  onDone?: () => void;
}

/** An email sign-up for one "it's here" email. */
export default function NotifyMe({ fragranceId, format, defaultEmail, cta = "Notify me", note, onDone }: Props) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const valid = EMAIL_RE.test(email.trim());

  if (state === "done") {
    return (
      <p role="status" style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: CREAM }}>
        <span style={{ color: GOLD }}>✓ You're on the list.</span> We'll email {email.trim()} once, when it's here.
      </p>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || state === "busy") return;
        setState("busy");
        const ok = await joinWaitlist(fragranceId, format, email);
        setState(ok ? "done" : "error");
        if (ok) onDone?.();
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          placeholder="Your email"
          aria-label="Your email"
          style={{ flex: "1 1 220px", minWidth: 0, height: 48, background: "none", border: "1px solid #2a2a33", outline: "none", color: CREAM, fontSize: 15, padding: "0 14px" }}
        />
        <button className="mo-cta" type="submit" disabled={!valid || state === "busy"} style={{ ...btnGold, height: 48, padding: "0 26px", opacity: valid ? 1 : 0.5 }}>
          {state === "busy" ? "Adding…" : cta}
        </button>
      </div>
      <p style={{ ...micro, fontSize: 9, margin: "8px 0 0", letterSpacing: "0.12em", textTransform: "none", color: state === "error" ? "#e08a7a" : "rgba(243,236,220,0.5)" }}>
        {state === "error" ? "That didn't go through. Check the address and try again." : note}
      </p>
    </form>
  );
}
