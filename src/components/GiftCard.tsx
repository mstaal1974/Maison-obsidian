import { useMemo, useState, type CSSProperties } from "react";
import { CREAM, GOLD } from "../lib/data";
import { voucherCheckout } from "../lib/stripe";
import VoucherCard, { type VoucherFinish } from "./VoucherCard";
import { Container } from "./ui";
import { SERIF, body, btnGold, micro } from "./styles";

const PRESETS = [20, 30, 50, 100];
const MIN = 10;
const MAX = 500;
const LIMIT = { to: 36, from: 36, message: 115 } as const;

/**
 * /gift-card — design a gift voucher and buy it. The card on the right is the
 * one they'll get: finish, value, names and note update as they type, and it
 * flips to show the back. The code is issued when payment clears, then emailed
 * (to the buyer, and to the recipient if given) and shown, printable, on the
 * thank-you page. Redeemed as a promotion code at checkout.
 */
export default function GiftCard({ cancelled, accountEmail }: { cancelled: boolean; accountEmail: string | null }) {
  const [finish, setFinish] = useState<VoucherFinish>("obsidian");
  const [amount, setAmount] = useState(50);
  const [custom, setCustom] = useState("");
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(accountEmail ?? "");
  const [sendTo, setSendTo] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(cancelled ? "Payment was cancelled — your voucher is still here." : null);

  const dollars = custom ? Number(custom) : amount;
  const amountOk = Number.isInteger(dollars) && dollars >= MIN && dollars <= MAX;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const recipientOk = !sendTo || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim());

  const issued = useMemo(() => new Date(), []);
  const expires = useMemo(() => {
    const d = new Date(issued);
    d.setFullYear(d.getFullYear() + 3);
    return d;
  }, [issued]);

  const buy = async () => {
    if (!amountOk || !emailOk || !recipientOk || busy) return;
    setBusy(true);
    setError(null);
    const r = await voucherCheckout({
      amount: dollars,
      finish,
      to: to.trim(),
      from: from.trim(),
      message: message.trim(),
      email: email.trim(),
      recipientEmail: sendTo ? recipientEmail.trim() : "",
    });
    if (r?.ok && r.data.url) {
      window.location.assign(r.data.url);
      return;
    }
    setBusy(false);
    // A 501 names what's missing in Vercel ("Missing in Vercel: STRIPE_SECRET_KEY").
    setError(r?.ok === false ? `${r.error}${r.detail ? ` — ${r.detail}` : ""}` : "Payments aren't available right now. Please try again shortly.");
  };

  return (
    <div style={{ background: "radial-gradient(circle at 10% 0%, rgba(212,175,55,0.06), transparent 40%), radial-gradient(circle at 100% 100%, rgba(197,160,89,0.05), transparent 45%)" }}>
      <Container style={{ paddingTop: 40, paddingBottom: 90 }}>
        <p style={{ ...micro, color: GOLD, margin: 0 }}>Gift voucher</p>
        <h1 style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(36px, 4.6vw, 56px)", lineHeight: 1.04, color: CREAM }}>Give them the house.</h1>
        <p style={{ ...body, margin: "12px 0 0", maxWidth: 600, fontSize: 15 }}>
          A Maison Obsidian gift voucher from ${MIN} to ${MAX}, emailed the moment it's paid — to you, or straight to them. Valid for three years on anything in the house.
        </p>

        <div className="mo-gc-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)", gap: 40, alignItems: "start", marginTop: 32 }}>
          {/* ─── The commission ────────────────────────────────────────── */}
          <section aria-label="Your voucher" style={{ background: "rgba(20,20,23,0.85)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 16, padding: "24px 22px", display: "grid", gap: 20 }}>
            <Group label="Cardstock">
              <div role="radiogroup" aria-label="Cardstock" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 4, background: "#070709", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 12 }}>
                {(["obsidian", "alabaster"] as VoucherFinish[]).map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={finish === f} onClick={() => setFinish(f)} style={seg(finish === f, f)}>
                    <span aria-hidden style={{ width: 10, height: 10, borderRadius: "50%", background: f === "obsidian" ? "#070709" : "#F7F4EC", border: `1px solid ${GOLD}` }} />
                    {f === "obsidian" ? "Obsidian Noir" : "Alabaster Silk"}
                  </button>
                ))}
              </div>
            </Group>

            <Group label="Value (AUD)">
              <div role="radiogroup" aria-label="Value" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {PRESETS.map((p) => {
                  const on = !custom && amount === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setAmount(p);
                        setCustom("");
                      }}
                      style={{ height: 42, borderRadius: 10, cursor: "pointer", fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: "0.06em", border: `1px solid ${on ? GOLD : "rgba(212,175,55,0.25)"}`, background: on ? "rgba(212,175,55,0.15)" : "#0b0b0d", color: on ? "#F1DFA9" : "rgba(245,242,235,0.8)" }}
                    >
                      ${p}
                    </button>
                  );
                })}
              </div>
              <div style={{ position: "relative", marginTop: 8 }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: GOLD, fontFamily: "'Cinzel', serif" }}>$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN}
                  max={MAX}
                  step={1}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                  placeholder={`Another amount, $${MIN}–$${MAX}`}
                  aria-label="Another amount in dollars"
                  style={{ ...input, paddingLeft: 30 }}
                />
              </div>
              {custom && !amountOk && <p style={{ ...hint, color: "#E08A6A" }}>Choose a whole-dollar amount from ${MIN} to ${MAX}.</p>}
            </Group>

            <div className="mo-gc-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Group label="Presented to">
                <input value={to} maxLength={LIMIT.to} onChange={(e) => setTo(e.target.value)} placeholder="Their name" style={input} />
              </Group>
              <Group label="Compliments of">
                <input value={from} maxLength={LIMIT.from} onChange={(e) => setFrom(e.target.value)} placeholder="Your name" style={input} />
              </Group>
            </div>

            <Group label="Personal note" aside={`${message.length} / ${LIMIT.message}`}>
              <textarea value={message} maxLength={LIMIT.message} rows={2} onChange={(e) => setMessage(e.target.value)} placeholder="With love — something to make every day smell like you." style={{ ...input, height: "auto", padding: "10px 14px", resize: "none", lineHeight: 1.5, fontFamily: "inherit" }} />
            </Group>

            <Group label="Your email" aside="Receipt and voucher">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" style={input} />
            </Group>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 14, color: "rgba(245,242,235,0.8)", lineHeight: 1.5 }}>
              <input type="checkbox" checked={sendTo} onChange={(e) => setSendTo(e.target.checked)} style={{ marginTop: 3, accentColor: GOLD }} />
              Also email it straight to them
            </label>
            {sendTo && (
              <Group label="Their email">
                <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="them@email.com" style={input} />
                {!recipientOk && recipientEmail && <p style={{ ...hint, color: "#E08A6A" }}>That email doesn't look right.</p>}
              </Group>
            )}

            <button
              type="button"
              onClick={() => void buy()}
              disabled={!amountOk || !emailOk || !recipientOk || busy}
              style={{ ...btnGold, height: 54, width: "100%", justifyContent: "center", opacity: amountOk && emailOk && recipientOk ? 1 : 0.5, cursor: amountOk && emailOk && recipientOk && !busy ? "pointer" : "not-allowed" }}
            >
              {busy ? "Opening payment…" : amountOk ? `Buy voucher · $${dollars}` : "Buy voucher"}
            </button>
            {!emailOk && <p style={{ ...hint, marginTop: -10 }}>Add your email to continue — that's where the voucher goes.</p>}
            {error && (
              <p role="alert" style={{ ...hint, color: "#E08A6A", marginTop: -8 }}>
                {error}
              </p>
            )}
          </section>

          {/* ─── The card ──────────────────────────────────────────────── */}
          <section aria-label="Voucher preview" style={{ display: "grid", justifyItems: "center", gap: 16 }}>
            <div style={{ display: "flex", gap: 6, padding: 4, background: "rgba(20,20,23,0.9)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 12 }}>
              {[false, true].map((b) => (
                <button key={String(b)} type="button" aria-pressed={flipped === b} onClick={() => setFlipped(b)} style={{ ...seg(flipped === b, "obsidian"), padding: "0 16px", height: 34 }}>
                  {b ? "Back & code" : "Front"}
                </button>
              ))}
            </div>
            <VoucherCard
              v={{ amountCents: (amountOk ? dollars : 0) * 100, to: to.trim(), from: from.trim(), message: message.trim(), code: null, issuedAt: issued, expiresAt: expires, finish }}
              flipped={flipped}
              onFlip={() => setFlipped((f) => !f)}
            />
            <p style={{ ...hint, textAlign: "center", margin: 0 }}>Tap the card to turn it over. Your code is issued the moment payment clears.</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 8, maxWidth: 520, fontSize: 14, color: "rgba(245,242,235,0.7)", lineHeight: 1.5 }}>
              <li>✦ Emailed instantly, with a printable card on the next page.</li>
              <li>✦ Used as a promotion code at checkout, on anything in the house.</li>
              <li>✦ Valid for three years. Use it in one order — any amount left over isn't kept.</li>
            </ul>
          </section>
        </div>
      </Container>
    </div>
  );
}

function Group({ label, aside, children }: { label: string; aside?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(223,193,109,0.92)" }}>{label}</span>
        {aside && <span style={{ fontSize: 11, color: "rgba(245,242,235,0.45)" }}>{aside}</span>}
      </span>
      {children}
    </label>
  );
}

const input: CSSProperties = { width: "100%", boxSizing: "border-box", height: 44, background: "#111115", border: "1px solid rgba(212,175,55,0.22)", borderRadius: 12, color: "#F5F2EB", padding: "0 14px", fontSize: 15, outline: "none" };
const hint: CSSProperties = { margin: "6px 0 0", fontSize: 12.5, color: "rgba(245,242,235,0.55)" };
function seg(on: boolean, f: VoucherFinish): CSSProperties {
  const light = on && f === "alabaster";
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 40,
    borderRadius: 9,
    cursor: "pointer",
    fontFamily: "'Cinzel', serif",
    fontSize: 11.5,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    border: `1px solid ${on ? (light ? GOLD : "rgba(212,175,55,0.45)") : "transparent"}`,
    background: light ? "#F7F4EC" : on ? "#141417" : "transparent",
    color: light ? "#070709" : on ? "#DFC16D" : "rgba(245,242,235,0.6)",
    fontWeight: on ? 600 : 400,
  };
}
