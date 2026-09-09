import { useState } from "react";
import { type Fragrance, GOLD, money } from "../lib/data";
import { FORMAT_BY_KEY } from "../lib/formats";
import { authorizePayment } from "../lib/stripe";
import {
  type DeliveryStatus,
  type Subscription,
  billSubscriptionMonth,
  cancelSubscription,
  monthsBilled,
  nextBillingDate,
  nextMonth,
  scentForNextBill,
  setDeliveryStatus,
  subscriptionPrice,
  subscriptionRange,
  useSubscriptions,
} from "../lib/subscription";
import { useAudience } from "../lib/audience";
import { affinityOf } from "../lib/profile";
import { btnGhost, chip, label } from "./adminStyles";

const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * Admin: every Monthly Pour. What each subscriber gets next, when it bills,
 * and the deliveries so far. "Bill month N" records the next charge the way
 * the processor's monthly run would; delivery rows move paid → shipped →
 * delivered as bottles go out.
 */
export default function AdminSubscriptions({ fragrances, configured }: { fragrances: Fragrance[]; configured: boolean }) {
  const { subscriptions, loading, reload } = useSubscriptions(true);
  // Surprise draws lean on a customer's taste only where they allowed it.
  const { members } = useAudience(fragrances, subscriptions);
  const affinityFor = (s: Subscription) => {
    const m = members.find((x) => (s.userId && x.userId === s.userId) || (s.userEmail && x.email === s.userEmail.toLowerCase()));
    return m?.ai ? affinityOf(m.profile) : undefined;
  };
  const [filter, setFilter] = useState<Subscription["status"] | "all">("active");
  const [busy, setBusy] = useState<string | null>(null);
  const shown = subscriptions.filter((s) => filter === "all" || s.status === filter);
  const active = subscriptions.filter((s) => s.status === "active");
  // Surprise subscriptions count at the catalogue's lowest member price.
  const monthly = active.reduce((sum, s) => {
    if (s.pickMode === "surprise") return sum + subscriptionRange(fragrances, s.format)[0];
    const f = fragrances.find((x) => x.id === s.nextFragranceId);
    return sum + (f ? subscriptionPrice(f, s.format) : 0);
  }, 0);

  const bill = async (s: Subscription) => {
    const f = scentForNextBill(s, fragrances, affinityFor(s));
    if (!f) return;
    setBusy(s.id);
    const charge = subscriptionPrice(f, s.format);
    const { paymentIntentId } = await authorizePayment(f.id, charge);
    await billSubscriptionMonth(s.id, f.id, charge, paymentIntentId);
    setBusy(null);
    reload();
  };
  const mark = async (deliveryId: string, status: DeliveryStatus) => {
    await setDeliveryStatus(deliveryId, status);
    reload();
  };
  const cancel = async (s: Subscription) => {
    setBusy(s.id);
    await cancelSubscription(s.id);
    setBusy(null);
    reload();
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 30, color: "#f3ecdc" }}>
            Monthly Pour <span style={{ color: GOLD }}>{active.length}</span> active · <span style={{ color: GOLD }}>{money(monthly)}</span> next month
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(243,236,220,0.5)", maxWidth: 760, lineHeight: 1.6 }}>
            Each subscriber's format, their pick for the coming month and when it bills. “Bill month” records the next charge and delivery the way the
            processor's monthly run does; move deliveries to shipped and delivered as bottles go out.
            {!configured && " Demo mode — subscriptions are stored in this browser."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["active", "completed", "cancelled", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ ...chip, cursor: "pointer", borderColor: filter === f ? GOLD : "#1f1f27", color: filter === f ? GOLD : "rgba(243,236,220,0.6)" }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
        {loading && !shown.length ? (
          <div style={{ border: "1px solid #1f1f27", padding: 22, fontSize: 12, color: "rgba(243,236,220,0.5)" }}>Loading…</div>
        ) : !shown.length ? (
          <div style={{ border: "1px solid #1f1f27", padding: 22, fontSize: 12, color: "rgba(243,236,220,0.5)" }}>No subscriptions here yet.</div>
        ) : (
          shown.map((s) => {
            const surprise = s.pickMode === "surprise";
            const next = surprise ? undefined : fragrances.find((x) => x.id === s.nextFragranceId);
            const n = nextMonth(s);
            const billing = nextBillingDate(s);
            return (
              <div key={s.id} style={{ border: "1px solid #1f1f27", background: "#101015", padding: "16px 18px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.2fr 150px 220px", gap: 14, alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#f3ecdc" }}>{FORMAT_BY_KEY[s.format].name}</div>
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10.5, color: "rgba(243,236,220,0.6)", wordBreak: "break-all" }}>{s.userEmail ?? "—"}</div>
                  </div>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "rgba(243,236,220,0.7)" }}>
                    <span style={{ color: GOLD }}>{Math.min(monthsBilled(s), s.months)}</span> / {s.months} billed
                    <div style={{ ...label, marginTop: 4 }}>{s.status}</div>
                  </div>
                  <div>
                    <div style={label}>Next pick</div>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19, color: "#f3ecdc" }}>{surprise ? "Surprise — house draws" : (next?.name ?? "—")}</div>
                    {surprise ? (
                      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10.5, color: GOLD }}>random, no repeats</div>
                    ) : (
                      next && <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10.5, color: GOLD }}>{money(subscriptionPrice(next, s.format))}</div>
                    )}
                  </div>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10.5, color: "rgba(243,236,220,0.65)" }}>
                    <div style={label}>Bills</div>
                    {billing ? fmtDate(billing) : "—"}
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {s.status === "active" && n !== null && (surprise || next) && (
                      <button style={{ ...btnGhost, height: 32, padding: "0 12px" }} disabled={busy === s.id} onClick={() => void bill(s)}>
                        Bill month {n}
                      </button>
                    )}
                    {s.status === "active" && (
                      <button style={{ ...btnGhost, height: 32, padding: "0 12px", color: "#d98a6a" }} disabled={busy === s.id} onClick={() => void cancel(s)}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
                {s.deliveries.length > 0 && (
                  <div style={{ marginTop: 12, borderTop: "1px solid #1f1f27", paddingTop: 10, display: "grid", gap: 6 }}>
                    {s.deliveries.map((d) => {
                      const f = fragrances.find((x) => x.id === d.fragranceId);
                      return (
                        <div key={d.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 90px 130px auto", gap: 12, alignItems: "center", fontFamily: "'Space Mono',monospace", fontSize: 10.5 }}>
                          <span style={{ color: "rgba(243,236,220,0.5)" }}>Month {d.month}</span>
                          <span style={{ color: "#f3ecdc" }}>{f?.name ?? d.fragranceId}</span>
                          <span style={{ color: GOLD }}>{money(d.chargeCents)}</span>
                          <span style={{ color: "rgba(243,236,220,0.6)" }}>{d.status} · {fmtDate(d.billedAt)}</span>
                          <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            {d.status === "paid" && <button style={{ ...btnGhost, height: 26, padding: "0 10px", fontSize: 9 }} onClick={() => void mark(d.id, "shipped")}>Shipped</button>}
                            {d.status === "shipped" && <button style={{ ...btnGhost, height: 26, padding: "0 10px", fontSize: 9 }} onClick={() => void mark(d.id, "delivered")}>Delivered</button>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
