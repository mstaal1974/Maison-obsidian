import { useEffect, useMemo, useState } from "react";
import { type Fragrance, GOLD, CREAM, money, moneyExact } from "../lib/data";
import { type BagLine, type Order, setQty, removeLine } from "../lib/bag";
import { sku as skuOf, FORMAT_BY_KEY } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import BottleImage from "./BottleImage";
import { Arrow, Icon } from "./ui";
import { MONO, SERIF, btnGold, btnGhost, btnLink, micro } from "./styles";
import { type ShippingRate, etaLabel, quoteShipping } from "../lib/shipping";

interface BagDrawerProps {
  lines: BagLine[];
  fragrances: Fragrance[];
  placed: Order[] | null; // just-placed orders → confirmation view
  busy: boolean;
  /** Checkout could not start (Stripe declined the bag, network). */
  error?: string | null;
  onClose: () => void;
  /** The chosen postage, when the customer has quoted one. */
  onCheckout: (shipping?: { postcode: string; code: string }) => void;
  onAddCar: (f: Fragrance) => void;
}

/**
 * Your bag. Lines are format SKUs of a fragrance; checkout charges the card and
 * places the order. The Drive cross-sell lives here because "take it with you"
 * is the obvious add at the end.
 */
export default function BagDrawer({ lines, fragrances, placed, busy, error, onClose, onCheckout, onAddCar }: BagDrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const byId = useMemo(() => new Map(fragrances.map((f) => [f.id, f])), [fragrances]);
  const rows = lines.map((l) => ({ line: l, frag: byId.get(l.fragranceId) })).filter((r): r is { line: BagLine; frag: Fragrance } => !!r.frag);
  const unit = (r: { line: BagLine; frag: Fragrance }) => r.line.unitPrice ?? skuOf(r.frag, r.line.format).price;
  const subtotal = rows.reduce((s, r) => s + unit(r) * r.line.qty, 0);
  const crossSell = rows.find((r) => FORMAT_BY_KEY[r.line.format].group === "wear" && !lines.some((l) => l.fragranceId === r.frag.id && l.format === "car") && skuOf(r.frag, "car").buyable)?.frag;

  // ── Australia Post postage ────────────────────────────────────────────────
  const [postcode, setPostcode] = useState("");
  // The quote is tied to the bag it was priced for; change the bag and it
  // simply stops matching, so there is nothing to reset.
  const [quote, setQuote] = useState<{ forBag: string; rates: ShippingRate[] } | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  // Postage is unavailable (route not deployed, or no AusPost key): fall back
  // to the flat promise rather than blocking checkout.
  const [postageOff, setPostageOff] = useState(false);
  const bagKey = lines.map((l) => `${l.fragranceId}:${l.format}:${l.qty}`).sort().join("|");
  const rates = quote?.forBag === bagKey ? quote.rates : null;
  const rate = rates?.find((r) => r.code === chosen) ?? null;
  const total = subtotal + (rate?.chargeCents ?? 0);

  const getRates = async () => {
    setQuoting(true);
    setQuoteError(null);
    const r = await quoteShipping(
      lines.map((l) => ({ fragranceId: l.fragranceId, format: l.format, qty: l.qty, engraving: l.engraving, label: l.label })),
      postcode.trim(),
    );
    setQuoting(false);
    if (r === null) {
      setPostageOff(true);
      return;
    }
    if (r.ok === false) {
      setQuoteError(r.error);
      return;
    }
    setQuote({ forBag: bagKey, rates: r.data.rates });
    setChosen(r.data.rates[0]?.code ?? null);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Your bag" style={{ position: "fixed", inset: 0, zIndex: 95, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }} />
      <aside className="mo-drawer mo-scroll" style={{ position: "relative", width: 470, maxWidth: "100%", height: "100%", overflowY: "auto", background: "#0f0f13", borderLeft: "1px solid #1f1f27", padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: SERIF, fontSize: 26, color: CREAM }}>
            <Icon name="bag" size={18} /> {placed ? "Thank you" : "Your bag"}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "1px solid #1f1f27", color: CREAM, width: 34, height: 34, cursor: "pointer" }}>×</button>
        </div>

        {placed ? (
          <div style={{ display: "grid", gap: 16 }}>
            <p style={{ margin: 0, fontFamily: SERIF, fontSize: 20, lineHeight: 1.35, color: "rgba(243,236,220,0.9)" }}>
              Your order is <span style={{ color: GOLD }}>confirmed</span>. Each bottle is filled to order and ships within 5–7 business days.
            </p>
            {placed.map((o) => {
              const f = byId.get(o.fragranceId);
              return f ? (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: "1px solid #1f1f27", paddingTop: 12 }}>
                  <span style={{ fontFamily: SERIF, fontSize: 16, color: CREAM }}>{f.name} <span style={{ color: "rgba(243,236,220,0.55)" }}>· {FORMAT_BY_KEY[o.format].name}{o.qty > 1 ? ` × ${o.qty}` : ""}</span></span>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: CREAM }}>{money(o.chargeCents * o.qty)}</span>
                </div>
              ) : null;
            })}
            <button className="mo-cta" style={{ ...btnGold, justifyContent: "center", marginTop: 8 }} onClick={() => { onClose(); navigate(paths.account); }}>
              My orders <Arrow />
            </button>
            <button style={{ ...btnLink, justifyContent: "center" }} onClick={() => { onClose(); navigate(paths.fragrances); }}>Keep exploring</button>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
            <p style={{ margin: 0, fontFamily: SERIF, fontSize: 22, color: "rgba(243,236,220,0.8)", lineHeight: 1.3 }}>Your bag is empty. One scent, every part of your day — start with the one you'd wear.</p>
            <button className="mo-cta" style={{ ...btnGold, justifyContent: "center" }} onClick={() => { onClose(); navigate(paths.fragrances); }}>Shop fragrances <Arrow /></button>
            <button style={{ ...btnLink, justifyContent: "center" }} onClick={() => { onClose(); navigate(paths.find()); }}>Find your scent</button>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gap: 12 }}>
              {rows.map(({ line, frag }) => {
                const s = skuOf(frag, line.format);
                return (
                  <div key={line.id} style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 14, alignItems: "center", borderBottom: "1px solid #1f1f27", paddingBottom: 12 }}>
                    <BottleImage imageUrl={frag.imageUrl} fallbackSrc="/assets/bottle-square.jpg" alt="" accent={frag.accent} liquid={frag.liquid} height={76} />
                    <div>
                      <div style={{ fontFamily: SERIF, fontSize: 18, color: CREAM, lineHeight: 1.05 }}>{frag.name}</div>
                      <div style={{ ...micro, marginTop: 4 }}>{line.label ? `${line.label} · ${s.def.label}` : s.def.name}{line.engraving ? ` · “${line.engraving}”` : ""}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <button aria-label="Decrease" onClick={() => setQty(line.id, line.qty - 1)} style={{ width: 26, height: 26, border: "1px solid #1f1f27", background: "none", color: CREAM, cursor: "pointer" }}>−</button>
                        <span style={{ fontFamily: MONO, fontSize: 12, color: CREAM, minWidth: 14, textAlign: "center" }}>{line.qty}</span>
                        <button aria-label="Increase" onClick={() => setQty(line.id, line.qty + 1)} style={{ width: 26, height: 26, border: "1px solid #1f1f27", background: "none", color: CREAM, cursor: "pointer" }}>+</button>
                        <button onClick={() => removeLine(line.id)} style={{ ...btnLink, color: "rgba(243,236,220,0.5)", marginLeft: 8, fontSize: 8.5 }}>Remove</button>
                      </div>
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 13, color: CREAM }}>{money((line.unitPrice ?? s.price) * line.qty)}</span>
                  </div>
                );
              })}
            </div>

            {crossSell && (
              <div style={{ border: "1px solid rgba(201,169,97,0.4)", padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 17, color: CREAM }}>Love {crossSell.name}? Take it with you.</div>
                  <div style={{ ...micro, marginTop: 4 }}>Car diffuser · {money(skuOf(crossSell, "car").price)}</div>
                </div>
                <button className="mo-ghost" style={{ ...btnGhost, height: 36, fontSize: 9 }} onClick={() => onAddCar(crossSell)}>Add car diffuser</button>
              </div>
            )}

            <div style={{ marginTop: "auto", borderTop: "1px solid #1f1f27", paddingTop: 14, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 12, color: CREAM }}>
                <span style={micro}>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>

              {!postageOff && (
                <div style={{ display: "grid", gap: 10, borderTop: "1px solid #1f1f27", paddingTop: 12 }}>
                  <span style={micro}>Postage · Australia Post</span>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void getRates();
                    }}
                    style={{ display: "flex", gap: 8 }}
                  >
                    <input
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="Postcode"
                      inputMode="numeric"
                      aria-label="Delivery postcode"
                      style={{ flex: 1, minWidth: 0, background: "none", border: "1px solid #1f1f27", outline: "none", height: 38, padding: "0 12px", color: CREAM, fontFamily: MONO, fontSize: 12 }}
                    />
                    <button type="submit" className="mo-ghost" style={{ ...btnGhost, height: 38, fontSize: 9 }} disabled={quoting || postcode.trim().length !== 4}>
                      {quoting ? "…" : rates ? "Recalculate" : "Calculate"}
                    </button>
                  </form>
                  {quoteError && <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "#d98a6a" }}>{quoteError}</div>}
                  {rates?.map((r) => (
                    <label key={r.code} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", border: `1px solid ${chosen === r.code ? "rgba(201,169,97,0.6)" : "#1f1f27"}`, padding: "9px 12px" }}>
                      <input type="radio" name="mo-postage" checked={chosen === r.code} onChange={() => setChosen(r.code)} style={{ accentColor: "#c9a961" }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontFamily: SERIF, fontSize: 16, color: CREAM, lineHeight: 1.2 }}>{r.name}</span>
                        {etaLabel(r) && <span style={{ display: "block", ...micro, fontSize: 8 }}>{etaLabel(r)}</span>}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: r.chargeCents === 0 ? "#8bb98a" : CREAM }}>
                        {r.chargeCents === 0 ? "Free" : moneyExact(r.chargeCents)}
                      </span>
                    </label>
                  ))}
                  {rate && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 14, color: CREAM, borderTop: "1px solid #1f1f27", paddingTop: 12 }}>
                      <span style={micro}>Total</span>
                      <span>{moneyExact(total)}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ ...micro, fontSize: 8, display: "flex", gap: 14 }}>
                <span><Icon name="truck" size={12} color="rgba(243,236,220,0.6)" /> Free shipping over $100</span>
                <span><Icon name="refresh" size={12} color="rgba(243,236,220,0.6)" /> 30-day returns</span>
              </div>
              <button className="mo-cta" style={{ ...btnGold, justifyContent: "center" }} disabled={busy} onClick={() => onCheckout(rate && postcode.trim().length === 4 ? { postcode: postcode.trim(), code: rate.code } : undefined)}>
                {busy ? "Opening secure checkout…" : "Checkout"} <Arrow />
              </button>
              {error && <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "#d98a6a" }}>{error}</div>}
              <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: "rgba(243,236,220,0.5)" }}>
                Secure card checkout by Stripe. Free shipping over $100 and 30-day returns.
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
