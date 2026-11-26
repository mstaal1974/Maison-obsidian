import { useState, type FormEvent } from "react";
import { CREAM, GOLD, moneyExact } from "../lib/data";
import { paths } from "../lib/route";
import { redeemSubscriptionGift, subscriptionGiftCheckout } from "../lib/stripe";
import { GIFT_CODE_PATTERN, GIFT_FORMATS, GIFT_TERMS, giftClaimPath, giftDescription, giftPlan, giftTotal, type SubscriptionGiftPlan } from "../../api/_lib/subscription-gift-plan";
import VoucherCard from "./VoucherCard";
import { Arrow, Container } from "./ui";
import { body, btnGold, btnLink, micro } from "./styles";
import "../styles/subscription-gift.css";

const LIMIT = { name: 36, message: 115, email: 200 };

export default function SubscriptionGift({ redeem, cancelled, email, onSignIn }: {
  redeem: boolean;
  cancelled: boolean;
  email: string | null;
  onSignIn: () => void;
}) {
  return (
    <main className="mo-subgift" data-screen-label="Monthly Pour Gift Card">
      <Container className="mo-subgift-container">
        <p style={{ ...micro, color: GOLD }}>The Monthly Pour</p>
        <h1>{redeem ? "Redeem your Monthly Pour gift" : "Monthly Pour Gift Card"}</h1>
        {redeem ? <RedeemGift email={email} onSignIn={onSignIn} /> : <BuyGift email={email} cancelled={cancelled} />}
      </Container>
    </main>
  );
}

function BuyGift({ email, cancelled }: { email: string | null; cancelled: boolean }) {
  const [plan, setPlan] = useState<SubscriptionGiftPlan>({ format: "perf30", months: 3 });
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");
  const [buyer, setBuyer] = useState(email ?? "");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(cancelled ? "Payment was cancelled." : "");
  const [flipped, setFlipped] = useState(false);
  const [issuedAt] = useState(() => new Date());
  const expiresAt = new Date(issuedAt);
  expiresAt.setFullYear(expiresAt.getFullYear() + 3);
  const total = giftTotal(plan);

  const buy = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await subscriptionGiftCheckout({ ...plan, to, from, message, email: buyer.trim(), recipientEmail: recipient.trim() });
    if (result?.ok && result.data.url) {
      window.location.assign(result.data.url);
      return;
    }
    setError(result?.ok === false ? result.error : "Checkout is temporarily unavailable. Please try again.");
    setBusy(false);
  };

  return (
    <>
      <p style={body}>Give one surprise scent each month for 3, 6 or 12 months. Pay once, with Australian delivery included. The recipient activates the gift when they’re ready.</p>
      <a href={giftClaimPath()} style={btnLink}>Redeem a Monthly Pour gift <Arrow size={10} /></a>
      <div className="mo-subgift-grid">
        <form className="mo-subgift-form" onSubmit={(e) => void buy(e)}>
          <h2>Choose the gift</h2>
          <div className="mo-subgift-fields">
            <label>Format
              <select value={plan.format} onChange={(e) => {
                const next = giftPlan(e.target.value, plan.months);
                if (next) setPlan(next);
              }}>
                {Object.entries(GIFT_FORMATS).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label>Gift term
              <select value={plan.months} onChange={(e) => {
                const next = giftPlan(plan.format, e.target.value);
                if (next) setPlan(next);
              }}>
                {GIFT_TERMS.map((months) => <option key={months} value={months}>{months} months</option>)}
              </select>
            </label>
          </div>
          <h2>Personalise the card</h2>
          <div className="mo-subgift-fields">
            <label>To <input value={to} maxLength={LIMIT.name} onChange={(e) => setTo(e.target.value)} /></label>
            <label>From <input value={from} maxLength={LIMIT.name} onChange={(e) => setFrom(e.target.value)} /></label>
          </div>
          <label>Gift message <textarea rows={3} value={message} maxLength={LIMIT.message} onChange={(e) => setMessage(e.target.value)} /></label>
          <label>Your email <input type="email" autoComplete="email" required value={buyer} maxLength={LIMIT.email} onChange={(e) => setBuyer(e.target.value)} /></label>
          <label>Recipient’s email (optional) <input type="email" value={recipient} maxLength={LIMIT.email} onChange={(e) => setRecipient(e.target.value)} /></label>
          <p className="mo-subgift-note">Leave the recipient’s email blank to forward the gift yourself. If you enter their email, they’ll use it to sign in and claim the gift.</p>
          <p className="mo-subgift-total" aria-live="polite"><strong>{moneyExact(total)} AUD</strong> paid once</p>
          <button className="mo-cta" type="submit" style={btnGold} disabled={busy}>{busy ? "Opening checkout…" : "Buy gift card"} <Arrow /></button>
          {error && <p role="alert" className="mo-subgift-error">{error}</p>}
        </form>
        <aside aria-label="Gift card preview">
          <VoucherCard v={{ amountCents: total, subscriptionGift: plan, to, from, message, code: null, issuedAt, expiresAt, finish: "obsidian" }} flipped={flipped} onFlip={() => setFlipped((current) => !current)} />
          <p className="mo-subgift-note">{giftDescription(plan)}. The gift is valid for three years and ends after the final delivery.</p>
        </aside>
      </div>
    </>
  );
}

function RedeemGift({ email, onSignIn }: { email: string | null; onSignIn: () => void }) {
  const [code, setCode] = useState(() => {
    const hash = window.location.hash.slice(1).toUpperCase();
    return GIFT_CODE_PATTERN.test(hash) ? hash : "";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const redeem = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!email) return onSignIn();
    const entered = code.trim().toUpperCase();
    if (!GIFT_CODE_PATTERN.test(entered)) {
      setError("Enter the Monthly Pour gift code from your card.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await redeemSubscriptionGift(entered);
    if (result?.ok && result.data.url) {
      window.location.assign(result.data.url);
      return;
    }
    setError(result?.ok === false ? result.error : "Redemption is temporarily unavailable. Please try again.");
    setBusy(false);
  };

  return (
    <form className="mo-subgift-form mo-subgift-claim" onSubmit={(e) => void redeem(e)}>
      <p style={{ ...body, margin: 0 }}>Use the code from your card and confirm your Australian delivery address to start your prepaid deliveries.</p>
      {email ? <p style={{ color: CREAM, margin: 0 }}>Signed in as {email}</p> : <p style={{ ...body, margin: 0 }}>Sign in or create an account to track your deliveries. Use the email the gift was sent to.</p>}
      <label>Gift code <input value={code} onChange={(e) => setCode(e.target.value)} required={!!email} maxLength={35} autoComplete="off" spellCheck={false} /></label>
      <button className="mo-cta" type="submit" style={btnGold} disabled={busy}>{busy ? "Opening redemption…" : email ? "Enter delivery address" : "Sign in to redeem"} <Arrow /></button>
      {error && <p role="alert" className="mo-subgift-error">{error}</p>}
      <a href={paths.subscriptionGift} style={btnLink}>Buy a Monthly Pour gift <Arrow size={10} /></a>
    </form>
  );
}
