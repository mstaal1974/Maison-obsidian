import type { ReactNode } from "react";
import { type Fragrance, GOLD, money } from "../lib/data";

export interface Order {
  frag: Fragrance;
  sizeMl?: number;
  formatLabel?: string; // e.g. "Car Diffuser 10ml"
  qty?: number;
  chargeCents?: number;
  engraving: string | null;
  status: "captured" | "authorized" | "released" | "void";
  placedAt?: string;
  shipmentStatus?: "pending" | "label_created" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  tracking?: string;
  trackingUrl?: string;
}

const SHIP_LABEL: Record<NonNullable<Order["shipmentStatus"]>, string> = {
  pending: "Preparing",
  label_created: "Label created",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Payment state, in shop language. */
const STATUS: Record<Order["status"], { label: string; color: string; bg: string }> = {
  captured: { label: "Paid", color: "#8bb98a", bg: "rgba(139,185,138,0.12)" },
  authorized: { label: "Processing", color: "#c9a961", bg: "rgba(201,169,97,0.1)" },
  released: { label: "Refunded", color: "rgba(243,236,220,0.55)", bg: "rgba(243,236,220,0.06)" },
  void: { label: "Cancelled", color: "rgba(243,236,220,0.5)", bg: "rgba(243,236,220,0.06)" },
};

interface MyOrdersProps {
  orders: Order[];
  loading: boolean;
  onOpen: (slug: string) => void;
  onBackToVault: () => void;
  /** The Monthly Pour panel, rendered above the orders. */
  subscriptionSlot?: ReactNode;
  /** Privacy & preferences, rendered below the orders. */
  preferencesSlot?: ReactNode;
  /** Back from Stripe Checkout: what just happened. */
  notice?: ReactNode;
}

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

/** Account: everything the customer has bought, plus their subscription and preferences. */
export default function MyOrders({ orders, loading, onOpen, onBackToVault, subscriptionSlot, preferencesSlot, notice }: MyOrdersProps) {
  return (
    <main data-screen-label="Account" style={{ maxWidth: 1340, margin: "0 auto", padding: "48px 32px 90px" }}>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(201,169,97,0.85)" }}>
        Your Account
      </div>
      <h1 style={{ margin: "14px 0 0", fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 54, lineHeight: 1.02, color: "#f3ecdc" }}>
        My <span style={{ fontStyle: "italic", color: "#c9a961" }}>Orders.</span>
      </h1>
      <p style={{ margin: "16px 0 0", maxWidth: 520, fontSize: 14, lineHeight: 1.7, color: "rgba(243,236,220,0.55)" }}>
        Everything you've bought from the house, with tracking once each parcel is on its way.
      </p>

      {notice}

      {subscriptionSlot}

      <div style={{ marginTop: 40 }}>
        <h2 style={{ margin: "0 0 18px", fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 34, color: "#f3ecdc" }}>
          Order <span style={{ fontStyle: "italic", color: "#c9a961" }}>history.</span>
        </h2>
        {loading ? (
          <p style={{ fontSize: 13, color: "rgba(243,236,220,0.5)" }}>Loading your orders…</p>
        ) : orders.length === 0 ? (
          <div style={{ border: "1px solid #1f1f27", padding: "60px 0", textAlign: "center" }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: "rgba(243,236,220,0.7)" }}>No orders yet.</div>
            <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "rgba(243,236,220,0.5)" }}>Your first bottle will appear here.</p>
            <button
              className="mo-cta"
              onClick={onBackToVault}
              style={{ marginTop: 24, background: GOLD, color: "#0b0b0d", border: 0, cursor: "pointer", height: 44, padding: "0 24px", fontSize: 10.5, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 600 }}
            >
              Shop the collection
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {orders.map((o, i) => {
              const s = STATUS[o.status];
              return (
                <div
                  key={`${o.frag.id}-${i}`}
                  className="mo-card"
                  style={{ border: "1px solid #1f1f27", background: "#101015", padding: 24, cursor: "pointer" }}
                  onClick={() => onOpen(o.frag.slug)}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, color: "#f3ecdc", lineHeight: 1 }}>{o.frag.name}</div>
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: "'Space Mono',monospace", fontSize: 11, color: "rgba(243,236,220,0.6)" }}>
                        <span>
                          {o.formatLabel ?? (o.sizeMl ? `${o.sizeMl} ml` : "")}
                          {o.qty && o.qty > 1 ? ` × ${o.qty}` : ""}
                        </span>
                        {o.chargeCents != null && (
                          <>
                            <span style={{ opacity: 0.4 }}>/</span>
                            <span style={{ color: "#c9a961" }}>{money(o.chargeCents)}</span>
                          </>
                        )}
                        {o.placedAt && (
                          <>
                            <span style={{ opacity: 0.4 }}>/</span>
                            <span>{fmtDate(o.placedAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span
                      style={{ flexShrink: 0, fontFamily: "'Space Mono',monospace", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: s.color, background: s.bg, border: `1px solid ${s.color}`, padding: "5px 10px" }}
                    >
                      {s.label}
                    </span>
                  </div>

                  {o.engraving && (
                    <div style={{ marginTop: 16 }}>
                      <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(243,236,220,0.42)" }}>Engraving</span>
                      <span style={{ marginLeft: 12, fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontSize: 18, color: "#c9a961" }}>“{o.engraving}”</span>
                    </div>
                  )}

                  {o.shipmentStatus && (
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #1f1f27", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#8bb98a" }}>
                        ● {SHIP_LABEL[o.shipmentStatus]}
                        {o.carrier ? ` · ${o.carrier}` : ""}
                      </span>
                      {o.tracking &&
                        (o.trackingUrl ? (
                          <a
                            href={o.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mo-link"
                            style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#c9a961", textDecoration: "none" }}
                          >
                            Track · {o.tracking}
                          </a>
                        ) : (
                          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "rgba(243,236,220,0.55)" }}>{o.tracking}</span>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {preferencesSlot}
    </main>
  );
}
