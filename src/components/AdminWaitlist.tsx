import { useMemo, useState } from "react";
import { type Fragrance, GOLD } from "../lib/data";
import { sku as skuOf } from "../lib/formats";
import { isLaunched, launchLabel } from "../lib/launch";
import { type WaitlistGroup, notifyWaitlist, useWaitlist } from "../lib/waitlist";
import { btnGhost, chip, label } from "./adminStyles";

const COLS = "1fr 200px 90px 90px 240px";

/**
 * Admin: who asked to hear when something arrives — a fragrance before its
 * launch date, or a Coming soon format. On the day, one press emails them all
 * once; everyone signed up for exactly that email.
 */
export default function AdminWaitlist({ fragrances, configured }: { fragrances: Fragrance[]; configured: boolean }) {
  const { groups, entries, loading, error, reload } = useWaitlist();
  const byId = useMemo(() => new Map(fragrances.map((f) => [f.id, f])), [fragrances]);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);

  const send = async (g: WaitlistGroup, what: string) => {
    if (!window.confirm(`Email ${g.waiting} ${g.waiting === 1 ? "person" : "people"} that ${what} is here? Each gets one email.`)) return;
    setBusy(g.key);
    const r = await notifyWaitlist(g.fragranceId, g.format);
    setBusy(null);
    setResult((cur) => ({ ...cur, [g.key]: r.ok === true ? `Sent ${r.sent}${r.failed ? `, ${r.failed} failed — press again to retry` : ""}` : r.error }));
    reload();
  };

  return (
    <section>
      <div>
        <h2 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 30, color: "#f3ecdc" }}>Waitlist</h2>
        <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.6, color: "rgba(243,236,220,0.5)", maxWidth: 760 }}>
          Everyone who pressed Notify me: on a fragrance's Coming soon page before its launch date, or on a format marked Coming soon. When it arrives, email
          them once. The button unlocks on launch day, or when the format is set live in the Product Matrix.
          {!configured && " Demo mode: sign-ups from this browser only, and nothing is really emailed."}
        </p>
        {error && <p style={{ margin: "10px 0 0", fontSize: 12, color: "#e08a7a" }}>Couldn't load the waitlist ({error}). Has migration 0035 been applied?</p>}
      </div>

      <div style={{ marginTop: 22, border: "1px solid #1f1f27" }}>
        <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 14, padding: "10px 16px", borderBottom: "1px solid #1f1f27" }}>
          {["Waiting for", "Status", "Waiting", "Emailed", ""].map((h, i) => (
            <span key={i} style={label}>{h}</span>
          ))}
        </div>
        {loading && !groups.length ? (
          <div style={{ padding: 22, fontSize: 12, color: "rgba(243,236,220,0.5)" }}>Loading…</div>
        ) : !groups.length ? (
          <div style={{ padding: 22, fontSize: 12, color: "rgba(243,236,220,0.5)" }}>Nobody is waiting yet. Give a fragrance a future launch date and its page takes sign-ups.</div>
        ) : (
          groups.map((g) => {
            const f = byId.get(g.fragranceId);
            const name = f?.name ?? g.fragranceId;
            const s = f && g.format ? skuOf(f, g.format) : null;
            const what = s ? `${name} ${s.def.name}` : name;
            const ready = !!f && isLaunched(f) && (!s || s.status === "live");
            const status = !f ? "Removed" : !isLaunched(f) ? `Launches ${launchLabel(f)}` : s ? (s.status === "live" ? "Live" : s.status === "coming_soon" ? "Coming soon" : "Hidden") : "Launched";
            const emails = entries.filter((e) => e.fragranceId === g.fragranceId && e.format === g.format && !e.notifiedAt).map((e) => e.email);
            return (
              <div key={g.key} style={{ borderBottom: "1px solid #1f1f27" }}>
                <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 14, alignItems: "center", padding: "14px 16px" }}>
                  <div>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19, color: "#f3ecdc" }}>{name}</div>
                    <div style={{ fontSize: 11.5, color: "rgba(243,236,220,0.55)", marginTop: 2 }}>{s ? s.def.name : "The launch"}</div>
                  </div>
                  <span style={{ ...chip, justifySelf: "start", color: ready ? GOLD : "rgba(243,236,220,0.6)" }}>{status}</span>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, color: "#f3ecdc" }}>{g.waiting}</span>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, color: "rgba(243,236,220,0.55)" }}>{g.notified}</span>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {g.waiting > 0 && (
                      <button style={{ ...btnGhost, height: 32, padding: "0 12px" }} onClick={() => setOpen(open === g.key ? null : g.key)}>
                        {open === g.key ? "Hide" : "Emails"}
                      </button>
                    )}
                    <button
                      disabled={!ready || g.waiting === 0 || busy === g.key}
                      title={ready ? undefined : "Unlocks on launch day, or when the format is live"}
                      style={{ ...btnGhost, height: 32, padding: "0 12px", opacity: ready && g.waiting ? 1 : 0.45, ...(ready && g.waiting ? { color: GOLD, borderColor: GOLD } : {}) }}
                      onClick={() => void send(g, what)}
                    >
                      {busy === g.key ? "Sending…" : "Email: it's here"}
                    </button>
                  </div>
                </div>
                {result[g.key] && <div style={{ padding: "0 16px 12px", fontSize: 12, color: GOLD, textAlign: "right" }}>{result[g.key]}</div>}
                {open === g.key && (
                  <div style={{ padding: "0 16px 14px", fontFamily: "'Space Mono',monospace", fontSize: 11.5, lineHeight: 1.7, color: "rgba(243,236,220,0.7)", wordBreak: "break-all" }}>{emails.join(", ")}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
