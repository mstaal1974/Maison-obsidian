import { CREAM, GOLD, moneyExact } from "../lib/data";
import { navigate, paths } from "../lib/route";
import { Arrow, Icon } from "./ui";
import { MONO, SERIF, btnGold, btnLink, micro } from "./styles";

export interface ThanksState {
  status: "checking" | "paid" | "error";
  /** Items paid for, when the confirmation came back. */
  itemCount?: number;
  amountTotal?: number | null;
  message?: string;
}

interface ThanksProps {
  state: ThanksState;
  /** The Checkout Session, shown as the order reference. */
  sessionId: string | null;
  signedIn: boolean;
  /** Guests are offered an account — never required to make one. */
  onJoin: () => void;
}

/**
 * Back from Stripe, paid. Guests land here too: the order is already recorded
 * against the email they gave, and an account is only ever an offer.
 */
export default function Thanks({ state, sessionId, signedIn, onJoin }: ThanksProps) {
  const reference = sessionId ? `MO-${sessionId.slice(-6).toUpperCase()}` : null;
  return (
    <main data-screen-label="Thank you" style={{ maxWidth: 720, margin: "0 auto", padding: "140px 32px 110px", textAlign: "center" }}>
      <div style={{ display: "inline-flex", width: 60, height: 60, borderRadius: "50%", border: `1px solid ${GOLD}`, alignItems: "center", justifyContent: "center" }}>
        <Icon name={state.status === "error" ? "hourglass" : "star"} size={24} />
      </div>
      <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 52, color: CREAM, margin: "22px 0 0", lineHeight: 1.05 }}>
        {state.status === "error" ? "Almost there." : "Order placed."}
      </h1>
      {reference && <p style={{ ...micro, marginTop: 14 }}>Order {reference}</p>}

      <p style={{ margin: "18px auto 0", maxWidth: 520, fontSize: 14, lineHeight: 1.75, color: "rgba(243,236,220,0.65)" }}>
        {state.status === "checking"
          ? "Confirming your payment…"
          : state.status === "error"
            ? state.message ?? "We couldn't confirm the payment just yet. If your card was charged, the order is safe — check your email for the receipt."
            : `Thank you. ${state.itemCount ? `${state.itemCount} item${state.itemCount > 1 ? "s" : ""}` : "Your order"}${state.amountTotal ? ` · ${moneyExact(state.amountTotal)} paid` : ""}. Each bottle is filled to order and ships within 5–7 business days, and your receipt is on its way by email.`}
      </p>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 32 }}>
        {signedIn ? (
          <button className="mo-cta" style={btnGold} onClick={() => navigate(paths.account)}>
            My orders <Arrow />
          </button>
        ) : (
          <button className="mo-cta" style={btnGold} onClick={onJoin}>
            Create an account <Arrow />
          </button>
        )}
        <button style={{ ...btnLink, fontSize: 9 }} onClick={() => navigate(paths.fragrances)}>Keep exploring</button>
      </div>

      {!signedIn && (
        <p style={{ margin: "20px auto 0", maxWidth: 480, fontFamily: MONO, fontSize: 11, lineHeight: 1.7, color: "rgba(243,236,220,0.45)" }}>
          You checked out as a guest — no account needed. Make one with the same email and this order joins your order history.
        </p>
      )}
    </main>
  );
}
