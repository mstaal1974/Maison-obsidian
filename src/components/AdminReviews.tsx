import { useMemo, useState } from "react";
import { type Fragrance, GOLD } from "../lib/data";
import { type Review, type ReviewStatus, setReviewStatus, useAdminReviews } from "../lib/reviews";
import { Stars } from "./Reviews";
import { btnGhost, chip, label } from "./adminStyles";

/**
 * Admin: reviews wait here until they're published. Only customers who bought
 * the fragrance can write one; this is the check that what they wrote is fit
 * to show. Publishing makes it visible on the product page and counts it in
 * the star rating search engines see after the next deploy.
 */
export default function AdminReviews({ fragrances, configured }: { fragrances: Fragrance[]; configured: boolean }) {
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending");
  const { reviews, loading, reload } = useAdminReviews(filter);
  const names = useMemo(() => new Map(fragrances.map((f) => [f.id, f.name])), [fragrances]);
  const [busy, setBusy] = useState<string | null>(null);

  const mark = async (r: Review, status: ReviewStatus) => {
    setBusy(r.id);
    await setReviewStatus(r.id, status);
    setBusy(null);
    reload();
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 30, color: "#f3ecdc" }}>Reviews</h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(243,236,220,0.5)" }}>
            From verified buyers. Nothing appears on the site until it is published here.
            {!configured && " Reviews need Supabase; the offline demo has none."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["pending", "published", "rejected", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ ...chip, cursor: "pointer", borderColor: filter === f ? GOLD : "#1f1f27", color: filter === f ? GOLD : "rgba(243,236,220,0.6)" }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 22, border: "1px solid #1f1f27" }}>
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 140px 220px", gap: 14, padding: "10px 16px", borderBottom: "1px solid #1f1f27" }}>
          {["Fragrance", "Review", "Received", ""].map((h, i) => (
            <span key={i} style={label}>{h}</span>
          ))}
        </div>
        {loading && !reviews.length ? (
          <div style={{ padding: 22, fontSize: 12, color: "rgba(243,236,220,0.5)" }}>Loading…</div>
        ) : !reviews.length ? (
          <div style={{ padding: 22, fontSize: 12, color: "rgba(243,236,220,0.5)" }}>{filter === "pending" ? "Nothing waiting for approval." : "Nothing here yet."}</div>
        ) : (
          reviews.map((r) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr 140px 220px", gap: 14, alignItems: "start", padding: "14px 16px", borderBottom: "1px solid #1f1f27" }}>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19, color: "#f3ecdc" }}>{names.get(r.fragranceId) ?? r.fragranceId}</div>
                <span style={{ ...chip, marginTop: 4, display: "inline-block", color: r.status === "pending" ? GOLD : "rgba(243,236,220,0.5)" }}>{r.status}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(243,236,220,0.8)" }}>
                <Stars value={r.rating} size={13} />
                {r.title && <div style={{ marginTop: 4, color: "#f3ecdc", fontWeight: 600 }}>{r.title}</div>}
                <div style={{ marginTop: 4, whiteSpace: "pre-line" }}>{r.body}</div>
                <div style={{ marginTop: 6, fontSize: 11, color: "rgba(243,236,220,0.5)" }}>— {r.displayName}</div>
              </div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10.5, color: "rgba(243,236,220,0.65)" }}>
                {new Date(r.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                {r.status !== "published" && (
                  <button disabled={busy === r.id} style={{ ...btnGhost, height: 32, padding: "0 12px", color: GOLD, borderColor: GOLD }} onClick={() => void mark(r, "published")}>Publish</button>
                )}
                {r.status !== "rejected" && (
                  <button disabled={busy === r.id} style={{ ...btnGhost, height: 32, padding: "0 12px" }} onClick={() => void mark(r, "rejected")}>Reject</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
