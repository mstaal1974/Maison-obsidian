import { useMemo, useState } from "react";
import { type Fragrance, GOLD } from "../lib/data";
import { type Mood, MOODS } from "../lib/formats";
import { type AudienceMember, type Draft, audienceCsv, draftNote, useAudience } from "../lib/audience";
import { useSubscriptions } from "../lib/subscription";
import { btnGhost, btnGold, chip, field, label } from "./adminStyles";

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

/**
 * Admin: the opted-in audience with a taste profile per person, a mood
 * filter to cut a segment, CSV export for the email tool, and an AI-drafted
 * note for the segment on screen.
 */
export default function AdminMarketing({ fragrances, configured }: { fragrances: Fragrance[]; configured: boolean }) {
  const { subscriptions } = useSubscriptions(true);
  const { members, loading } = useAudience(fragrances, subscriptions);
  const [mood, setMood] = useState<Mood | null>(null);
  const [q, setQ] = useState("");
  const [angle, setAngle] = useState("");
  const [draft, setDraft] = useState<{ draft: Draft; source: "claude" | "template" } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [copied, setCopied] = useState(false);

  const optedIn = useMemo(() => members.filter((m) => m.marketing), [members]);
  const shown = useMemo(
    () =>
      optedIn.filter((m) => (!mood || m.profile.moods.some((x) => x.id === mood)) && (!q.trim() || m.email.includes(q.trim().toLowerCase()) || m.profile.summary.toLowerCase().includes(q.trim().toLowerCase()))),
    [optedIn, mood, q],
  );

  // What the segment gravitates to, for the draft.
  const topScents = useMemo(() => {
    const tally = new Map<string, number>();
    for (const m of shown) for (const f of m.profile.favourites) tally.set(f.fragrance.name, (tally.get(f.fragrance.name) ?? 0) + f.weight);
    return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
  }, [shown]);
  const segmentText = `${shown.length} customer${shown.length === 1 ? "" : "s"} who opted in to email${mood ? `, leaning ${mood.toLowerCase()}` : ""}${topScents.length ? `; they gravitate to ${topScents.join(", ")}` : "; mostly new, little history yet"}.`;

  const exportCsv = () => {
    const blob = new Blob([audienceCsv(shown)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maison-obsidian-audience${mood ? `-${mood.toLowerCase()}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const write = async () => {
    setDrafting(true);
    setCopied(false);
    setDraft(await draftNote(segmentText, topScents.join(", "), angle.trim()));
    setDrafting(false);
  };

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.draft.subject}\nPreview: ${draft.draft.preview}\n\n${draft.draft.body}`);
      setCopied(true);
    } catch {
      /* clipboard blocked — the text is on screen */
    }
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 30, color: "#f3ecdc" }}>
            Audience <span style={{ color: GOLD }}>{optedIn.length}</span> opted in · <span style={{ color: GOLD }}>{optedIn.filter((m) => m.ai).length}</span> personalised
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(243,236,220,0.5)", maxWidth: 820, lineHeight: 1.6 }}>
            Everyone who said yes to email, with what their history says they love. Cut a segment by mood, export it for your email tool, or have the house draft a
            note. The concierge and surprise draws use a profile only where the person also allowed personalisation.
            {!configured && " Demo mode — the audience is this browser's signups."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or taste" aria-label="Search audience" style={{ ...field, width: 220 }} />
          <button style={{ ...btnGhost, height: 40 }} onClick={exportCsv} disabled={!shown.length}>Export CSV ({shown.length})</button>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={label}>Segment</span>
        <button onClick={() => setMood(null)} style={{ ...chip, cursor: "pointer", borderColor: !mood ? GOLD : "#1f1f27", color: !mood ? GOLD : "rgba(243,236,220,0.6)" }}>all</button>
        {MOODS.map((m) => {
          const n = optedIn.filter((x) => x.profile.moods.some((y) => y.id === m.id)).length;
          return (
            <button key={m.id} onClick={() => setMood(mood === m.id ? null : m.id)} style={{ ...chip, cursor: "pointer", borderColor: mood === m.id ? GOLD : "#1f1f27", color: mood === m.id ? GOLD : "rgba(243,236,220,0.6)" }}>
              {m.id.toLowerCase()} {n ? `· ${n}` : ""}
            </button>
          );
        })}
      </div>

      <div className="mo-marketing-grid" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>
        <div style={{ border: "1px solid #1f1f27" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.6fr 110px 130px", gap: 14, padding: "10px 16px", borderBottom: "1px solid #1f1f27" }}>
            {["Customer", "Taste", "Consent", "Opted in"].map((h) => (
              <span key={h} style={label}>{h}</span>
            ))}
          </div>
          {loading && !shown.length ? (
            <div style={{ padding: 22, fontSize: 12, color: "rgba(243,236,220,0.5)" }}>Loading…</div>
          ) : !shown.length ? (
            <div style={{ padding: 22, fontSize: 12, color: "rgba(243,236,220,0.5)", lineHeight: 1.6 }}>
              {optedIn.length ? "No one in this segment yet." : "No one has opted in yet. The footer box, sign-up tick boxes and account preferences all feed this list."}
            </div>
          ) : (
            shown.map((m) => <Row key={m.email} m={m} />)
          )}
        </div>

        <aside style={{ border: "1px solid rgba(201,169,97,0.45)", background: "#101015", padding: 20, display: "grid", gap: 12, position: "sticky", top: 90 }}>
          <div style={label}>Draft a note to this segment</div>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.7)" }}>{segmentText}</p>
          <input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="What's it about? e.g. Smoky Obsidian pours Friday" aria-label="Angle" style={field} />
          <button className="mo-cta" style={{ ...btnGold, height: 40 }} disabled={drafting || !shown.length} onClick={() => void write()}>
            {drafting ? "Writing…" : "Draft with AI"}
          </button>
          {draft && (
            <div style={{ borderTop: "1px solid #1f1f27", paddingTop: 12, display: "grid", gap: 8 }}>
              <div style={{ ...label, color: draft.source === "claude" ? GOLD : "rgba(243,236,220,0.45)" }}>{draft.source === "claude" ? "Drafted by Claude" : "House template (AI not configured)"}</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#f3ecdc" }}>{draft.draft.subject}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10.5, color: "rgba(243,236,220,0.55)" }}>{draft.draft.preview}</div>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: "rgba(243,236,220,0.8)", whiteSpace: "pre-wrap" }}>{draft.draft.body}</p>
              <button style={{ ...btnGhost, height: 34 }} onClick={() => void copy()}>{copied ? "Copied" : "Copy for your email tool"}</button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function Row({ m }: { m: AudienceMember }) {
  const p = m.profile;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.6fr 110px 130px", gap: 14, padding: "12px 16px", borderBottom: "1px solid #1f1f27", alignItems: "start" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#f3ecdc", wordBreak: "break-all" }}>{m.email}</div>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: "rgba(243,236,220,0.5)", marginTop: 4 }}>
          {m.purchases} purchase{m.purchases === 1 ? "" : "s"}
          {m.subscription ? ` · Monthly Pour ${m.subscription.status}` : ""}
          {m.source ? ` · via ${m.source}` : ""}
        </div>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.55, color: "rgba(243,236,220,0.7)" }}>
        {p.empty ? (
          <span style={{ color: "rgba(243,236,220,0.4)" }}>No history yet</span>
        ) : (
          <>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
              {p.moods.map((x) => (
                <span key={x.id} style={{ ...chip, fontSize: 9, color: GOLD }}>{x.id.toLowerCase()}</span>
              ))}
            </div>
            {p.favourites.map((f) => f.fragrance.name).join(", ")}
          </>
        )}
      </div>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, lineHeight: 1.7 }}>
        <div style={{ color: "#8bb98a" }}>email ✓</div>
        <div style={{ color: m.ai ? "#8bb98a" : "rgba(243,236,220,0.35)" }}>{m.ai ? "AI ✓" : "AI —"}</div>
      </div>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10.5, color: "rgba(243,236,220,0.6)" }}>{fmtDate(m.optedInAt)}</div>
    </div>
  );
}
