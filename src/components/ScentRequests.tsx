import { useState } from "react";
import { GOLD } from "../lib/data";
import { type RequestGroup, type RequestStatus, setRequestStatus, useScentRequests } from "../lib/requests";
import { btnGhost, chip, label } from "./adminStyles";

/**
 * Admin: what customers searched for that we don't carry. Repeat asks for the
 * same scent collapse into one line with a count, so the most-wanted sit on
 * top. Mark a line sourced once it's in the catalogue, or declined.
 */
export default function ScentRequests({ configured }: { configured: boolean }) {
  const { groups, loading, reload } = useScentRequests();
  const [filter, setFilter] = useState<RequestStatus | "all">("open");
  const shown = groups.filter((g) => filter === "all" || g.status === filter);
  const openCount = groups.filter((g) => g.status === "open").length;

  const mark = async (g: RequestGroup, status: RequestStatus) => {
    await setRequestStatus(g.ids, status);
    reload();
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 30, color: "#f3ecdc" }}>
            Scent requests <span style={{ color: GOLD }}>{openCount}</span> open
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(243,236,220,0.5)" }}>
            Searches from “Find my match” that had no scent in the house. Grouped by ask; the count is how many customers wanted it.
            {!configured && " Demo mode — requests are stored in this browser."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["open", "sourced", "declined", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ ...chip, cursor: "pointer", borderColor: filter === f ? GOLD : "#1f1f27", color: filter === f ? GOLD : "rgba(243,236,220,0.6)" }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 22, border: "1px solid #1f1f27" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 1fr 150px 200px", gap: 14, padding: "10px 16px", borderBottom: "1px solid #1f1f27" }}>
          {["Requested scent", "Asks", "Notify", "Last asked", ""].map((h, i) => (
            <span key={i} style={label}>{h}</span>
          ))}
        </div>
        {loading && !shown.length ? (
          <div style={{ padding: 22, fontSize: 12, color: "rgba(243,236,220,0.5)" }}>Loading…</div>
        ) : !shown.length ? (
          <div style={{ padding: 22, fontSize: 12, color: "rgba(243,236,220,0.5)" }}>
            {filter === "open" ? "No open requests. When a search finds nothing in the house, the customer's ask lands here." : "Nothing here yet."}
          </div>
        ) : (
          shown.map((g) => (
            <div key={g.key} style={{ display: "grid", gridTemplateColumns: "1fr 90px 1fr 150px 200px", gap: 14, alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #1f1f27" }}>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#f3ecdc" }}>{g.query}</div>
                <span style={{ ...chip, marginTop: 4, display: "inline-block", color: g.status === "open" ? GOLD : "rgba(243,236,220,0.5)" }}>{g.status}</span>
              </div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, color: GOLD }}>×{g.count}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10.5, color: "rgba(243,236,220,0.65)", lineHeight: 1.6, wordBreak: "break-all" }}>
                {g.emails.length ? g.emails.join(", ") : <span style={{ color: "rgba(243,236,220,0.35)" }}>no email left</span>}
              </div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10.5, color: "rgba(243,236,220,0.65)" }}>
                {new Date(g.latest).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                {g.status !== "sourced" && (
                  <button style={{ ...btnGhost, height: 32, padding: "0 12px" }} onClick={() => void mark(g, "sourced")}>Sourced</button>
                )}
                {g.status !== "declined" && (
                  <button style={{ ...btnGhost, height: 32, padding: "0 12px" }} onClick={() => void mark(g, "declined")}>Decline</button>
                )}
                {g.status !== "open" && (
                  <button style={{ ...btnGhost, height: 32, padding: "0 12px" }} onClick={() => void mark(g, "open")}>Reopen</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
