import { type CSSProperties, useState } from "react";
import { type Fragrance, GOLD, CREAM } from "../lib/data";
import { type Review, type RatingSummary, submitReview, useCanReview } from "../lib/reviews";
import { Container } from "./ui";
import { MONO, SERIF, btnGhost, btnGold, btnLink, micro } from "./styles";

/** Five stars, filled to the nearest half. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span aria-hidden style={{ display: "inline-flex", gap: 1, fontSize: size, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ position: "relative", color: "#3a3a44" }}>
          ★
          <span style={{ position: "absolute", inset: 0, overflow: "hidden", width: rounded >= i ? "100%" : rounded >= i - 0.5 ? "50%" : "0%", color: GOLD }}>★</span>
        </span>
      ))}
    </span>
  );
}

const field: CSSProperties = { width: "100%", boxSizing: "border-box", background: "#0e0e12", border: "1px solid #2a2a33", color: CREAM, padding: "11px 12px", fontSize: 14, fontFamily: "inherit" };

interface ReviewsProps {
  frag: Fragrance;
  reviews: Review[];
  summary: RatingSummary | null;
  enabled: boolean;
  userId: string | null;
  onSignIn: () => void;
}

/** Verified-buyer reviews for a fragrance, and the form to write one. */
export default function Reviews({ frag, reviews, summary, enabled, userId, onSignIn }: ReviewsProps) {
  const canReview = useCanReview(frag.id, userId);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(5);
  if (!enabled) return null;

  return (
    <section id="reviews" aria-label="Reviews" style={{ borderBottom: "1px solid #1f1f27", scrollMarginTop: 90 }}>
      <Container style={{ padding: "26px 32px 30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 28, color: CREAM }}>Reviews</h2>
            {summary && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 13, color: CREAM }}>
                <Stars value={summary.average} /> {summary.average.toFixed(1)} · {summary.count} {summary.count === 1 ? "review" : "reviews"}
              </span>
            )}
          </div>
          {canReview ? (
            !open && <button className="mo-ghost" style={{ ...btnGhost, height: 38, fontSize: 9.5 }} onClick={() => setOpen(true)}>Write a review</button>
          ) : !userId ? (
            <button style={btnLink} onClick={onSignIn}>Bought this? Sign in to review</button>
          ) : null}
        </div>
        <p style={{ margin: "6px 0 0", ...micro, fontSize: 8.5 }}>Reviews are from customers who bought {frag.name}, and are checked before they appear.</p>

        {open && <ReviewForm frag={frag} onDone={() => setOpen(false)} />}

        {!reviews.length ? (
          <p style={{ margin: "18px 0 0", fontSize: 14, color: "rgba(243,236,220,0.55)" }}>No reviews yet.</p>
        ) : (
          <div style={{ marginTop: 16, display: "grid", gap: 0 }}>
            {reviews.slice(0, shown).map((r) => (
              <article key={r.id} style={{ padding: "16px 0", borderTop: "1px solid #1f1f27" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <Stars value={r.rating} />
                  {r.title && <strong style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 400, color: CREAM }}>{r.title}</strong>}
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.65, color: "rgba(243,236,220,0.82)", whiteSpace: "pre-line" }}>{r.body}</p>
                <div style={{ marginTop: 8, ...micro, fontSize: 8.5 }}>
                  {r.displayName} · Verified buyer · {new Date(r.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </article>
            ))}
            {reviews.length > shown && (
              <button style={{ ...btnLink, marginTop: 8, justifySelf: "start" }} onClick={() => setShown((n) => n + 10)}>
                Show more reviews
              </button>
            )}
          </div>
        )}
      </Container>
    </section>
  );
}

function ReviewForm({ frag, onDone }: { frag: Fragrance; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div style={{ marginTop: 16, border: "1px solid rgba(201,169,97,0.5)", padding: "14px 16px", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 14, color: CREAM }}>Thank you. Your review will appear here once it has been checked.</span>
        <button style={btnLink} onClick={onDone}>Close</button>
      </div>
    );
  }

  const send = async () => {
    if (!rating) return setError("Choose a star rating.");
    if (body.trim().length < 10) return setError("Tell us a little more — at least a sentence.");
    if (!name.trim()) return setError("Add the name to show with your review.");
    setBusy(true);
    setError(null);
    const r = await submitReview({ fragranceId: frag.id, rating, title: title.trim(), body: body.trim(), displayName: name.trim() });
    setBusy(false);
    if (r.ok === true) setSent(true);
    else setError(r.error);
  };

  return (
    <div style={{ marginTop: 16, border: "1px solid #1f1f27", background: "#101015", padding: 16, display: "grid", gap: 12, maxWidth: 640 }}>
      <div role="radiogroup" aria-label="Rating" style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            role="radio"
            aria-checked={rating === i}
            aria-label={`${i} star${i === 1 ? "" : "s"}`}
            onClick={() => setRating(i)}
            style={{ background: "none", border: 0, padding: 2, cursor: "pointer", fontSize: 26, lineHeight: 1, color: i <= rating ? GOLD : "#3a3a44" }}
          >
            ★
          </button>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Headline (optional)" aria-label="Headline" style={field} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} rows={5} placeholder={`How does ${frag.name} wear on you?`} aria-label="Your review" style={{ ...field, resize: "vertical" }} />
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Name to show, e.g. Sam R." aria-label="Name to show" autoComplete="given-name" style={field} />
      {error && <p style={{ margin: 0, fontSize: 13, color: "#e8a0a0" }}>{error}</p>}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="mo-cta" style={{ ...btnGold, height: 44 }} disabled={busy} onClick={() => void send()}>
          {busy ? "Sending…" : "Submit review"}
        </button>
        <button style={btnLink} onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}
