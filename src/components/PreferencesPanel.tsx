import { useState } from "react";
import { GOLD, CREAM } from "../lib/data";
import { type Consents, type TasteProfile } from "../lib/profile";
import { MONO, SERIF, micro } from "./styles";

interface PreferencesPanelProps {
  consents: Consents;
  taste: TasteProfile | null;
  onChange: (c: Consents) => Promise<void> | void;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * Account: the two consents, each a plain switch the customer can turn off
 * at any time, and — when they've allowed personalisation — a transparent
 * look at what the house has inferred about their taste.
 */
export default function PreferencesPanel({ consents, taste, onChange }: PreferencesPanelProps) {
  const [busy, setBusy] = useState(false);
  const set = async (patch: Partial<Consents>) => {
    setBusy(true);
    await onChange({ ...consents, ...patch });
    setBusy(false);
  };

  const rows: { key: keyof Pick<Consents, "marketing" | "ai">; title: string; body: string; since?: string | null }[] = [
    { key: "marketing", title: "Email me about new batches and offers", body: "A note when a scent you might like pours, and the occasional offer. Turning this off unsubscribes you from all marketing email.", since: consents.marketingAt },
    { key: "ai", title: "Personalise suggestions from my history", body: "Lets the concierge and Monthly Pour surprises use what you've bought, subscribed to and asked for. Turn it off and they treat you as new.", since: consents.aiAt },
  ];

  return (
    <section style={{ marginTop: 44 }}>
      <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 300, fontSize: 34, color: CREAM }}>
        Privacy &amp; <span style={{ fontStyle: "italic", color: GOLD }}>preferences.</span>
      </h2>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.5)", maxWidth: 620 }}>
        Nothing about you is used for marketing or suggestions unless you say so here. Both are off by default and you can change them at any time.
      </p>
      <div style={{ marginTop: 20, border: "1px solid #1f1f27", background: "#101015" }}>
        {rows.map((r, i) => (
          <label key={r.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center", padding: "18px 22px", borderTop: i ? "1px solid #1f1f27" : 0, cursor: "pointer" }}>
            <span>
              <span style={{ display: "block", fontFamily: SERIF, fontSize: 21, color: CREAM, lineHeight: 1.1 }}>{r.title}</span>
              <span style={{ display: "block", marginTop: 6, fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.55)" }}>{r.body}</span>
              {consents[r.key] && r.since && <span style={{ display: "block", marginTop: 6, fontFamily: MONO, fontSize: 10, color: "rgba(243,236,220,0.4)" }}>Opted in {fmtDate(r.since)}</span>}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: consents[r.key] ? GOLD : "rgba(243,236,220,0.5)" }}>
              {consents[r.key] ? "On" : "Off"}
              <input
                type="checkbox"
                role="switch"
                aria-checked={consents[r.key]}
                aria-label={r.title}
                checked={consents[r.key]}
                disabled={busy}
                onChange={(e) => void set({ [r.key]: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: GOLD, cursor: "pointer" }}
              />
            </span>
          </label>
        ))}
      </div>

      {consents.ai && (
        <div style={{ marginTop: 14, border: "1px dashed rgba(201,169,97,0.4)", padding: "16px 22px" }}>
          <div style={{ ...micro, color: GOLD }}>What the house has learned</div>
          {!taste ? (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "rgba(243,236,220,0.5)" }}>Reading your history…</p>
          ) : taste.empty ? (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.55)" }}>Nothing yet. As you reserve, subscribe or ask the concierge, your taste profile builds here, and you can see it.</p>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {taste.moods.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ ...micro, fontSize: 8.5 }}>Leans</span>
                  {taste.moods.map((m) => (
                    <span key={m.id} style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: CREAM, border: "1px solid #1f1f27", padding: "4px 8px" }}>{m.id}</span>
                  ))}
                </div>
              )}
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: "rgba(243,236,220,0.65)" }}>{taste.summary}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
