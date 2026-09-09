import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { type Fragrance, CREAM, GOLD, money, moneyExact } from "../lib/data";
import type { BagLine } from "../lib/bag";
import { sku as skuOf, FORMAT_BY_KEY } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import { type CheckoutDelivery, type ShippingRate, etaLabel, quoteShipping } from "../lib/shipping";
import { Arrow, Icon } from "./ui";
import { MONO, SERIF, btnGold, btnLink, micro } from "./styles";

interface CheckoutProps {
  lines: BagLine[];
  fragrances: Fragrance[];
  /** Signed-in email, used to prefill the contact field. */
  email?: string | null;
  busy: boolean;
  /** Checkout could not start (Stripe declined the bag, network). */
  error?: string | null;
  /** The buyer came back from Stripe without paying — bag intact. */
  cancelled?: boolean;
  onPlaceOrder: (delivery: CheckoutDelivery) => void;
}

const field: CSSProperties = {
  width: "100%",
  background: "none",
  border: "1px solid #1f1f27",
  outline: "none",
  height: 42,
  padding: "0 13px",
  color: CREAM,
  fontFamily: MONO,
  fontSize: 12,
  boxSizing: "border-box",
};
const blockLabel: CSSProperties = { ...micro, display: "block", marginBottom: 10 };

/**
 * Checkout. Contact, delivery and the order summary live here; the card is
 * entered on Stripe's own page after Place Order, so no card detail ever
 * touches this site. Postage is quoted live from Australia Post as soon as a
 * postcode is typed, and re-quoted server-side before the charge.
 */
export default function Checkout({ lines, fragrances, email, busy, error, cancelled, onPlaceOrder }: CheckoutProps) {
  const byId = useMemo(() => new Map(fragrances.map((f) => [f.id, f])), [fragrances]);
  const rows = lines.map((l) => ({ line: l, frag: byId.get(l.fragranceId) })).filter((r): r is { line: BagLine; frag: Fragrance } => !!r.frag);
  const unit = (r: { line: BagLine; frag: Fragrance }) => r.line.unitPrice ?? skuOf(r.frag, r.line.format).price;
  const subtotal = rows.reduce((s, r) => s + unit(r) * r.line.qty, 0);

  const [method, setMethod] = useState<"auspost" | "alternate">("auspost");
  const [contact, setContact] = useState(email ?? "");
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postcode, setPostcode] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  // Postage is unavailable (route not deployed, or no Australia Post key):
  // fall back to confirming it after checkout rather than blocking the order.
  const [postageOff, setPostageOff] = useState(false);

  // ── Live Australia Post quote ─────────────────────────────────────────────
  // A quote belongs to one bag and one postcode; change either and the old
  // answer simply stops matching, so there is nothing to reset.
  const bagKey = lines.map((l) => `${l.fragranceId}:${l.format}:${l.qty}`).sort().join("|");
  const quoteKey = method === "auspost" && !postageOff && /^\d{4}$/.test(postcode) && rows.length > 0 ? `${bagKey}@${postcode}` : null;
  const [quote, setQuote] = useState<{ key: string; status: "loading" | "ready" | "error"; rates?: ShippingRate[]; error?: string } | null>(null);
  const ship = quote?.key === quoteKey ? quote : null;
  const rates = ship?.status === "ready" ? (ship.rates ?? []) : null;
  const rate = rates ? (rates.find((r) => r.code === chosen) ?? rates[0] ?? null) : null;

  useEffect(() => {
    if (!quoteKey) return;
    let active = true;
    // Debounced, like typing a postcode: the last keystroke wins.
    const timer = setTimeout(() => {
      setQuote({ key: quoteKey, status: "loading" });
      void quoteShipping(
        lines.map((l) => ({ fragranceId: l.fragranceId, format: l.format, qty: l.qty, engraving: l.engraving, label: l.label })),
        quoteKey.slice(quoteKey.lastIndexOf("@") + 1),
      ).then((r) => {
        if (!active) return;
        if (r === null) {
          setPostageOff(true);
          setQuote(null);
        } else if (r.ok === true) {
          setQuote({ key: quoteKey, status: "ready", rates: r.data.rates });
        } else {
          setQuote({ key: quoteKey, status: "error", error: r.error });
        }
      });
    }, 450);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [quoteKey, lines]);

  const alternate = method === "alternate";
  // Alternate delivery is arranged directly, so nothing is charged for it.
  const shippingCents = alternate ? 0 : (rate?.chargeCents ?? 0);
  const total = subtotal + shippingCents;

  const delivery: CheckoutDelivery = alternate
    ? { method: "alternate", email: contact.trim(), name: fullName.trim(), phone: phone.trim(), notes: notes.trim() }
    : {
        method: "auspost",
        email: contact.trim(),
        name: fullName.trim(),
        address: address.trim(),
        city: city.trim(),
        region: region.trim(),
        ...(postcode.trim().length === 4 ? { postcode: postcode.trim() } : {}),
        ...(rate && postcode.trim().length === 4 ? { code: rate.code } : {}),
      };

  const missing = alternate
    ? [contact, fullName, phone, notes].some((v) => !v.trim())
    : [contact, fullName, address, city].some((v) => !v.trim()) || postcode.trim().length !== 4;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim());
  const formError = !rows.length
    ? "Your bag is empty."
    : missing
      ? alternate
        ? "Please fill in your email, name, mobile and delivery details."
        : "Please fill in your email and shipping address."
      : !validEmail
        ? "That email address doesn't look right."
        : null;

  const place = () => {
    if (formError) {
      setShowError(true);
      return;
    }
    setShowError(false);
    onPlaceOrder(delivery);
  };

  const shippingCell = alternate
    ? { value: "Free", note: "Alternate delivery — arranged with you", tone: "#8bb98a" }
    : postageOff
      ? { value: "To confirm", note: "We'll confirm the postage with you after checkout.", tone: CREAM }
      : ship?.status === "loading"
        ? { value: "Calculating…", note: "", tone: CREAM }
        : ship?.status === "error"
          ? { value: "Unavailable", note: ship.error ?? "", tone: "#d98a6a" }
          : rate
            ? { value: rate.chargeCents === 0 ? "Free" : moneyExact(rate.chargeCents), note: `Australia Post · ${rate.name}`, tone: rate.chargeCents === 0 ? "#8bb98a" : CREAM }
            : { value: "Enter postcode", note: "", tone: "rgba(243,236,220,0.55)" };

  if (!rows.length) {
    return (
      <main data-screen-label="Checkout" style={{ maxWidth: 1340, margin: "0 auto", padding: "120px 32px", textAlign: "center" }}>
        <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 44, color: CREAM, margin: 0 }}>Your bag is empty.</h1>
        <p style={{ marginTop: 12, fontSize: 13, color: "rgba(243,236,220,0.5)" }}>One scent, every part of your day — start with the one you'd wear.</p>
        <button className="mo-cta" style={{ ...btnGold, marginTop: 26 }} onClick={() => navigate(paths.fragrances)}>
          Shop fragrances <Arrow />
        </button>
      </main>
    );
  }

  return (
    <main data-screen-label="Checkout" style={{ maxWidth: 1160, margin: "0 auto", padding: "116px 32px 90px" }}>
      <button style={{ ...btnLink, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 9 }} onClick={() => navigate(paths.fragrances)}>
        ← Back to shopping
      </button>
      <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 46, color: CREAM, margin: "14px 0 0" }}>Checkout</h1>
      {cancelled && (
        <p style={{ marginTop: 14, border: "1px solid rgba(201,169,97,0.5)", padding: "12px 16px", fontSize: 13, lineHeight: 1.6, color: "rgba(243,236,220,0.75)" }}>
          You came back without paying — nothing was charged. Your bag is exactly as you left it.
        </p>
      )}

      <div className="mo-checkout-grid" style={{ marginTop: 30, display: "grid", gridTemplateColumns: "minmax(0,1fr) 400px", gap: 34, alignItems: "start" }}>
        {/* ── Details ── */}
        <div style={{ display: "grid", gap: 26 }}>
          <div>
            <span style={blockLabel}>Contact</span>
            <input type="email" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email address" autoComplete="email" aria-label="Email address" style={field} />
          </div>

          <div>
            <span style={blockLabel}>Delivery</span>
            <div style={{ display: "grid", gap: 10 }}>
              {(
                [
                  { key: "auspost" as const, title: "Ship via Australia Post", body: postageOff ? "We'll confirm the postage with you after checkout." : "Live rate to your address, calculated below." },
                  { key: "alternate" as const, title: "Arrange alternate delivery", body: "Hand delivery or via a friend — no postage charged." },
                ]
              ).map((o) => (
                <label key={o.key} style={{ display: "flex", alignItems: "flex-start", gap: 11, cursor: "pointer", border: `1px solid ${method === o.key ? "rgba(201,169,97,0.6)" : "#1f1f27"}`, padding: "13px 14px" }}>
                  <input type="radio" name="mo-delivery" checked={method === o.key} onChange={() => setMethod(o.key)} style={{ marginTop: 3, accentColor: "#c9a961" }} />
                  <span>
                    <span style={{ display: "block", fontFamily: SERIF, fontSize: 18, color: CREAM, lineHeight: 1.2 }}>{o.title}</span>
                    <span style={{ display: "block", marginTop: 3, fontSize: 12, lineHeight: 1.5, color: "rgba(243,236,220,0.55)" }}>{o.body}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <span style={blockLabel}>{alternate ? "Delivery details" : "Shipping address"}</span>
            <div style={{ display: "grid", gap: 10 }}>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" autoComplete="name" aria-label="Full name" style={field} />
              {alternate ? (
                <>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" autoComplete="tel" inputMode="tel" aria-label="Mobile number" style={field} />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="How should we get this to you? A hand delivery, a pickup time, or a friend's name, address and contact."
                    aria-label="Delivery details"
                    rows={4}
                    style={{ ...field, height: "auto", padding: "11px 13px", lineHeight: 1.6, resize: "vertical" }}
                  />
                </>
              ) : (
                <>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" autoComplete="street-address" aria-label="Street address" style={field} />
                  <div className="mo-checkout-triple" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.9fr", gap: 10 }}>
                    <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Suburb" autoComplete="address-level2" aria-label="Suburb" style={field} />
                    <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="State" autoComplete="address-level1" aria-label="State" style={field} />
                    <input
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="Postcode"
                      autoComplete="postal-code"
                      inputMode="numeric"
                      aria-label="Postcode"
                      style={field}
                    />
                  </div>
                  <div style={{ ...micro, fontSize: 8 }}>Australia only · postage is quoted live as you type your postcode</div>
                </>
              )}
            </div>
          </div>

          {!alternate && rates && rates.length > 1 && (
            <div>
              <span style={blockLabel}>Postage</span>
              <div style={{ display: "grid", gap: 10 }}>
                {rates.map((r) => (
                  <label key={r.code} style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer", border: `1px solid ${rate?.code === r.code ? "rgba(201,169,97,0.6)" : "#1f1f27"}`, padding: "11px 14px" }}>
                    <input type="radio" name="mo-postage" checked={rate?.code === r.code} onChange={() => setChosen(r.code)} style={{ accentColor: "#c9a961" }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: SERIF, fontSize: 17, color: CREAM, lineHeight: 1.2 }}>{r.name}</span>
                      {etaLabel(r) && <span style={{ display: "block", ...micro, fontSize: 8 }}>{etaLabel(r)}</span>}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: r.chargeCents === 0 ? "#8bb98a" : CREAM }}>{r.chargeCents === 0 ? "Free" : moneyExact(r.chargeCents)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <span style={blockLabel}>Payment</span>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", border: "1px solid #1f1f27", padding: "14px 16px" }}>
              <Icon name="lock" size={15} color={GOLD} />
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: "rgba(243,236,220,0.62)" }}>
                Card details are entered on Stripe's secure checkout after you place the order. We never see or store your card — only Stripe does.
              </p>
            </div>
          </div>
        </div>

        {/* ── Summary ── */}
        <aside style={{ border: "1px solid #1f1f27", background: "#101015", padding: 22, display: "grid", gap: 14, position: "sticky", top: 100 }}>
          <span style={blockLabel}>Order summary</span>
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map(({ line, frag }) => {
              const s = skuOf(frag, line.format);
              return (
                <div key={line.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                  <span style={{ fontFamily: SERIF, fontSize: 17, color: CREAM, lineHeight: 1.25 }}>
                    {frag.name} <span style={{ color: "rgba(243,236,220,0.55)" }}>× {line.qty}</span>
                    <span style={{ display: "block", ...micro, fontSize: 8 }}>
                      {line.label ? `${line.label} · ${s.def.label}` : FORMAT_BY_KEY[line.format].name}
                      {line.engraving ? ` · “${line.engraving}”` : ""}
                    </span>
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: CREAM }}>{money(unit({ line, frag }) * line.qty)}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: 6, borderTop: "1px solid #1f1f27", paddingTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 12, color: CREAM }}>
              <span style={micro}>Subtotal</span>
              <span>{moneyExact(subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 12 }}>
              <span style={micro}>Shipping</span>
              <span data-testid="summary-shipping" style={{ color: shippingCell.tone }}>{shippingCell.value}</span>
            </div>
            {shippingCell.note && <div style={{ fontSize: 11, lineHeight: 1.5, color: shippingCell.tone === "#d98a6a" ? "#d98a6a" : "rgba(243,236,220,0.5)" }}>{shippingCell.note}</div>}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid #1f1f27", paddingTop: 14, fontFamily: MONO, color: CREAM }}>
            <span style={micro}>Total</span>
            <span style={{ fontFamily: SERIF, fontSize: 30 }}>{moneyExact(total)}</span>
          </div>

          <button className="mo-cta" style={{ ...btnGold, justifyContent: "center", opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={place}>
            {busy ? "Opening secure checkout…" : `Place order · ${moneyExact(total)}`} <Arrow />
          </button>
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: "rgba(243,236,220,0.45)", textAlign: "center" }}>Secured by Stripe · you'll confirm payment on the next step.</p>
          {(showError && formError) || error ? <div style={{ fontSize: 12, lineHeight: 1.55, color: "#d98a6a" }}>{error ?? formError}</div> : null}
          <div style={{ ...micro, fontSize: 8, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <span>
              <Icon name="truck" size={12} color="rgba(243,236,220,0.6)" /> Free shipping over $100
            </span>
            <span>
              <Icon name="refresh" size={12} color="rgba(243,236,220,0.6)" /> 30-day returns
            </span>
          </div>
        </aside>
      </div>
    </main>
  );
}
