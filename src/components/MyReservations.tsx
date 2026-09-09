import type { ReactNode } from "react";
import { type Fragrance, GOLD, money } from "../lib/data";

export interface Reservation {
  frag: Fragrance;
  sizeMl?: number;
  formatLabel?: string; // e.g. "Car Diffuser 10ml"
  qty?: number;
  chargeCents?: number;
  engraving: string | null;
  status: "authorized" | "captured" | "released" | "void";
  effectiveCommitted: number;
  shipmentStatus?: "pending" | "label_created" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  tracking?: string;
  trackingUrl?: string;
}

const SHIP_LABEL: Record<NonNullable<Reservation["shipmentStatus"]>, string> = {
  pending: "Preparing",
  label_created: "Label created",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

interface MyReservationsProps {
  reservations: Reservation[];
  loading: boolean;
  onOpen: (slug: string) => void;
  onBackToVault: () => void;
  /** The Monthly Pour panel, rendered above the reservations. */
  subscriptionSlot?: ReactNode;
}

const STATUS: Record<Reservation["status"], { label: string; color: string; bg: string }> = {
  authorized: { label: "Authorized", color: "#c9a961", bg: "rgba(201,169,97,0.1)" },
  captured: { label: "Captured", color: "#8bb98a", bg: "rgba(139,185,138,0.12)" },
  released: { label: "Released", color: "rgba(243,236,220,0.55)", bg: "rgba(243,236,220,0.06)" },
  void: { label: "Void", color: "rgba(243,236,220,0.5)", bg: "rgba(243,236,220,0.06)" },
};

export default function MyReservations({ reservations, loading, onOpen, onBackToVault, subscriptionSlot }: MyReservationsProps) {
  return (
    <main data-screen-label="Account" style={{ maxWidth: 1340, margin: "0 auto", padding: "48px 32px 90px" }}>
      <div
        style={{
          fontFamily: "'Space Mono',monospace",
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "rgba(201,169,97,0.85)",
        }}
      >
        Your Account
      </div>
      <h1
        style={{
          margin: "14px 0 0",
          fontFamily: "'Cormorant Garamond',serif",
          fontWeight: 300,
          fontSize: 54,
          lineHeight: 1.02,
          color: "#f3ecdc",
        }}
      >
        My <span style={{ fontStyle: "italic", color: "#c9a961" }}>Reservations.</span>
      </h1>
      <p style={{ margin: "16px 0 0", maxWidth: 520, fontSize: 14, lineHeight: 1.7, color: "rgba(243,236,220,0.55)" }}>
        Every batch you've reserved. Your card is held — never charged — until each batch reaches its floor and the lab
        opens.
      </p>

      {subscriptionSlot}

      <div style={{ marginTop: 40 }}>
        <h2 style={{ margin: "0 0 18px", fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 34, color: "#f3ecdc" }}>
          Batch <span style={{ fontStyle: "italic", color: "#c9a961" }}>Reservations.</span>
        </h2>
        {loading ? (
          <p style={{ fontSize: 13, color: "rgba(243,236,220,0.5)" }}>Loading your reservations…</p>
        ) : reservations.length === 0 ? (
          <div style={{ border: "1px solid #1f1f27", padding: "60px 0", textAlign: "center" }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: "rgba(243,236,220,0.7)" }}>
              No reservations yet.
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "rgba(243,236,220,0.5)" }}>
              Commit to a batch and it will appear here.
            </p>
            <button
              className="mo-cta"
              onClick={onBackToVault}
              style={{
                marginTop: 24,
                background: GOLD,
                color: "#0b0b0d",
                border: 0,
                cursor: "pointer",
                height: 44,
                padding: "0 24px",
                fontSize: 10.5,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Enter the Vault
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {reservations.map((r, i) => {
              const pct = Math.min(100, Math.round((r.effectiveCommitted / r.frag.moq) * 100));
              const met = r.effectiveCommitted >= r.frag.moq;
              const s = STATUS[r.status];
              return (
                <div
                  key={`${r.frag.id}-${i}`}
                  className="mo-card"
                  style={{ border: "1px solid #1f1f27", background: "#101015", padding: 24, cursor: "pointer" }}
                  onClick={() => onOpen(r.frag.slug)}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, color: "#f3ecdc", lineHeight: 1 }}>
                        {r.frag.name}
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          fontFamily: "'Space Mono',monospace",
                          fontSize: 11,
                          color: "rgba(243,236,220,0.6)",
                        }}
                      >
                        <span>{r.formatLabel ?? (r.sizeMl ? `${r.sizeMl} ml` : "")}{r.qty && r.qty > 1 ? ` × ${r.qty}` : ""}</span>
                        {r.chargeCents != null && (
                          <>
                            <span style={{ opacity: 0.4 }}>/</span>
                            <span style={{ color: "#c9a961" }}>{money(r.chargeCents)} held</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        fontFamily: "'Space Mono',monospace",
                        fontSize: 9,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: s.color,
                        background: s.bg,
                        border: `1px solid ${s.color}`,
                        padding: "5px 10px",
                      }}
                    >
                      {s.label}
                    </span>
                  </div>

                  {r.engraving && (
                    <div style={{ marginTop: 16 }}>
                      <span
                        style={{
                          fontFamily: "'Space Mono',monospace",
                          fontSize: 9,
                          letterSpacing: "0.2em",
                          textTransform: "uppercase",
                          color: "rgba(243,236,220,0.42)",
                        }}
                      >
                        Engraving
                      </span>
                      <span style={{ marginLeft: 12, fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontSize: 18, color: "#c9a961" }}>
                        “{r.engraving}”
                      </span>
                    </div>
                  )}

                  <div style={{ marginTop: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontFamily: "'Space Mono',monospace",
                        fontSize: 10,
                        color: "rgba(243,236,220,0.5)",
                        marginBottom: 7,
                      }}
                    >
                      <span>
                        {r.effectiveCommitted} / {r.frag.moq} committed
                      </span>
                      <span style={{ color: "#c9a961" }}>{met ? "Batch met" : `${pct}%`}</span>
                    </div>
                    <div style={{ height: 2, background: "#1f1f27" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: GOLD }} />
                    </div>
                  </div>

                  {r.shipmentStatus && (
                    <div
                      style={{
                        marginTop: 16,
                        paddingTop: 14,
                        borderTop: "1px solid #1f1f27",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#8bb98a" }}>
                        ● {SHIP_LABEL[r.shipmentStatus]}
                        {r.carrier ? ` · ${r.carrier}` : ""}
                      </span>
                      {r.tracking &&
                        (r.trackingUrl ? (
                          <a
                            href={r.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mo-link"
                            style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#c9a961", textDecoration: "none" }}
                          >
                            Track · {r.tracking}
                          </a>
                        ) : (
                          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "rgba(243,236,220,0.55)" }}>
                            {r.tracking}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
