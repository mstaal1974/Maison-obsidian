import { useEffect, useMemo } from "react";
import { type Fragrance, GOLD, CREAM, money } from "../lib/data";
import { type BagLine, type Order, setQty, removeLine } from "../lib/bag";
import { sku as skuOf, FORMAT_BY_KEY } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import BottleImage from "./BottleImage";
import { Arrow, Icon } from "./ui";
import { MONO, SERIF, btnGold, btnGhost, btnLink, micro } from "./styles";

interface BagDrawerProps {
  lines: BagLine[];
  fragrances: Fragrance[];
  placed: Order[] | null; // just-placed orders → confirmation view
  busy: boolean;
  /** Checkout could not start (Stripe declined the bag, network). */
  error?: string | null;
  onClose: () => void;
  onCheckout: () => void;
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
              <div style={{ ...micro, fontSize: 8, display: "flex", gap: 14 }}>
                <span><Icon name="truck" size={12} color="rgba(243,236,220,0.6)" /> Free shipping over $100</span>
                <span><Icon name="refresh" size={12} color="rgba(243,236,220,0.6)" /> 30-day returns</span>
              </div>
              <button className="mo-cta" style={{ ...btnGold, justifyContent: "center" }} disabled={busy} onClick={onCheckout}>
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
