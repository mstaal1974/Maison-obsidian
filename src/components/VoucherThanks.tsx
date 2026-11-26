import { useEffect, useState } from "react";
import { CREAM, GOLD, money } from "../lib/data";
import type { IssuedVoucher } from "../lib/stripe";
import { navigate, paths } from "../lib/route";
import { giftClaimPath, giftDescription } from "../../api/_lib/subscription-gift-plan";
import VoucherCard, { type VoucherFace } from "./VoucherCard";
import { SERIF, btnGold, btnGhost, micro } from "./styles";

/**
 * Back from paying for a gift voucher: the card itself, with its real code,
 * ready to print (front and back on one page) or copy. It is also emailed.
 */
export default function VoucherThanks({ v, email }: { v: IssuedVoucher; email?: { sent: boolean; error?: string; to?: string[] } }) {
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const face: VoucherFace = {
    amountCents: v.amountCents,
    subscriptionGift: v.subscriptionGift,
    to: v.to,
    from: v.from,
    message: v.message,
    code: v.code,
    issuedAt: new Date(v.issuedAt),
    expiresAt: new Date(v.expiresAt),
    finish: v.finish,
  };

  // Printing shows only the two flat faces (index.css, body.mo-printing-voucher).
  useEffect(() => {
    const done = () => document.body.classList.remove("mo-printing-voucher");
    window.addEventListener("afterprint", done);
    return () => {
      window.removeEventListener("afterprint", done);
      done();
    };
  }, []);
  const print = () => {
    document.body.classList.add("mo-printing-voucher");
    window.print();
  };
  const claimPath = v.subscriptionGift ? giftClaimPath(v.code) : null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(claimPath ? new URL(claimPath, window.location.origin).href : v.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      /* the code is on screen to copy by hand */
    }
  };

  return (
    <main data-screen-label="Gift voucher" style={{ maxWidth: 820, margin: "0 auto", padding: "110px 20px 100px", textAlign: "center" }}>
      <p style={{ ...micro, color: GOLD, margin: 0 }}>{v.subscriptionGift ? "Monthly Pour Gift Card" : "Gift voucher"} · paid</p>
      <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(38px, 6vw, 52px)", color: CREAM, margin: "14px 0 0", lineHeight: 1.05 }}>{v.subscriptionGift ? "Your Monthly Pour gift is ready." : "Your voucher is ready."}</h1>
      <p style={{ margin: "14px auto 0", maxWidth: 560, fontSize: 15, lineHeight: 1.7, color: "rgba(243,236,220,0.7)" }}>
        {v.subscriptionGift ? giftDescription(v.subscriptionGift) : money(v.amountCents)}
        {v.to ? ` for ${v.to}` : ""}.{" "}
        {email?.sent ? `We’ve emailed it to ${email.to?.join(" and ") ?? "you"}.` : "You can still share the gift from this page."}{" "}
        {v.subscriptionGift ? "Share the redemption link so the recipient can activate their deliveries." : "Print or forward it. To redeem, enter the code as the promotion code at checkout."}
      </p>
      {email && !email.sent && (
        <p role="status" style={{ margin: "14px auto 0", maxWidth: 560, fontSize: 13.5, lineHeight: 1.6, color: "#E8B48F", border: "1px solid rgba(232,180,143,0.4)", padding: "10px 14px" }}>
          We couldn't send every email{email.error ? `: ${email.error}` : "."} Your code is below and works now — keep a copy.
        </p>
      )}

      <div style={{ marginTop: 34 }}>
        <VoucherCard v={face} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
        <VoucherCard v={face} flipped={false} printable />
      </div>

      <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 12, border: `1px solid rgba(201,169,97,0.5)`, padding: "10px 12px 10px 18px", flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Cinzel', serif", fontSize: 20, letterSpacing: "0.18em", color: "#F1DFA9", overflowWrap: "anywhere" }}>{v.code}</span>
        <button type="button" onClick={() => void copy()} style={{ ...btnGhost, height: 38 }}>
          {copied ? "Copied" : claimPath ? "Copy gift link" : "Copy code"}
        </button>
      </div>

      <div style={{ marginTop: 22, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={print} style={{ ...btnGold, height: 50 }}>Print / save as PDF</button>
        <button type="button" onClick={() => setFlipped((f) => !f)} style={{ ...btnGhost, height: 50 }}>{flipped ? "Show front" : "Show back"}</button>
        <button type="button" onClick={() => navigate(paths.home)} style={{ ...btnGhost, height: 50 }}>Back to the house</button>
      </div>
      <p style={{ ...micro, marginTop: 22, color: "rgba(243,236,220,0.45)", lineHeight: 1.8 }}>
        Valid until {face.expiresAt.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })} · {v.subscriptionGift ? "one activation" : "one order"} · not redeemable for cash
      </p>
    </main>
  );
}
