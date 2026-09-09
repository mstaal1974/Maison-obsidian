import { useState } from "react";
import { type Fragrance, GOLD, CREAM, money } from "../lib/data";
import { referenceOf } from "../lib/formats";
import {
  type Subscription,
  cancelSubscription,
  monthsBilled,
  nextBillingDate,
  nextMonth,
  setSubscriptionPick,
  subscriptionLabel,
  subscriptionPrice,
} from "../lib/subscription";
import { navigate, paths } from "../lib/route";
import BottleImage from "./BottleImage";
import { Arrow, InspiredBy } from "./ui";
import { MONO, SERIF, btnGhost, btnLink, micro } from "./styles";

interface SubscriptionPanelProps {
  subscriptions: Subscription[];
  fragrances: Fragrance[];
  loading: boolean;
  onChanged: () => void;
}

const STATUS: Record<Subscription["status"], { label: string; color: string }> = {
  active: { label: "Active", color: "#8bb98a" },
  cancelled: { label: "Cancelled", color: "rgba(243,236,220,0.5)" },
  completed: { label: "Complete", color: GOLD },
};

const DELIVERY: Record<Subscription["deliveries"][number]["status"], string> = {
  paid: "Paid · pouring",
  shipped: "Shipped",
  delivered: "Delivered",
};

const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Account: the customer's Monthly Pour — next scent, deliveries, cancel. */
export default function SubscriptionPanel({ subscriptions, fragrances, loading, onChanged }: SubscriptionPanelProps) {
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const pick = async (s: Subscription, fragranceId: string) => {
    setBusy(true);
    await setSubscriptionPick(s.id, fragranceId);
    setBusy(false);
    onChanged();
  };
  const cancel = async (s: Subscription) => {
    setBusy(true);
    await cancelSubscription(s.id);
    setBusy(false);
    setConfirmCancel(null);
    onChanged();
  };

  return (
    <section style={{ marginTop: 44 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 300, fontSize: 34, color: CREAM }}>
          The <span style={{ fontStyle: "italic", color: GOLD }}>Monthly Pour.</span>
        </h2>
        {!subscriptions.some((s) => s.status === "active") && (
          <button style={btnLink} onClick={() => navigate(paths.subscribe())}>Start a subscription <Arrow size={10} /></button>
        )}
      </div>

      {loading ? (
        <p style={{ marginTop: 16, fontSize: 13, color: "rgba(243,236,220,0.5)" }}>Loading your subscription…</p>
      ) : subscriptions.length === 0 ? (
        <div style={{ marginTop: 20, border: "1px solid #1f1f27", padding: "34px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 24, color: "rgba(243,236,220,0.8)" }}>A new scent every month, 10% off.</div>
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "rgba(243,236,220,0.5)", maxWidth: 520, lineHeight: 1.6 }}>
              Choose a 10, 30 or 50 ml bottle or the car diffuser, pick your scent each month, and pay 10% under the shelf price for twelve months.
            </p>
          </div>
          <button className="mo-ghost" style={btnGhost} onClick={() => navigate(paths.subscribe())}>Explore the Monthly Pour <Arrow size={10} /></button>
        </div>
      ) : (
        <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
          {subscriptions.map((s) => {
            const next = fragrances.find((f) => f.id === s.nextFragranceId) ?? null;
            const n = nextMonth(s);
            const billing = nextBillingDate(s);
            const st = STATUS[s.status];
            return (
              <article key={s.id} style={{ border: `1px solid ${s.status === "active" ? "rgba(201,169,97,0.5)" : "#1f1f27"}`, background: "#101015", padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontFamily: SERIF, fontSize: 28, color: CREAM, lineHeight: 1 }}>{subscriptionLabel(s)}</div>
                    <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 11, color: "rgba(243,236,220,0.6)" }}>
                      Month {Math.min(monthsBilled(s), s.months)} of {s.months} · started {fmtDate(s.startedAt)}
                    </div>
                  </div>
                  <span style={{ ...micro, color: st.color, border: `1px solid ${st.color}`, padding: "5px 10px" }}>{st.label}</span>
                </div>

                <div style={{ marginTop: 18, height: 2, background: "#1f1f27" }}>
                  <div style={{ height: "100%", width: `${Math.round((monthsBilled(s) / s.months) * 100)}%`, background: GOLD }} />
                </div>

                {s.status === "active" && n !== null && (
                  <div className="mo-subnext-grid" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "88px 1fr auto", gap: 18, alignItems: "center", borderTop: "1px solid #1f1f27", paddingTop: 20 }}>
                    {next ? (
                      <BottleImage imageUrl={next.imageUrl} fallbackSrc="/assets/bottle-square.jpg" alt="" accent={next.accent} liquid={next.liquid} height={104} />
                    ) : (
                      <div style={{ height: 104, border: "1px dashed #1f1f27" }} />
                    )}
                    <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                      <div style={{ ...micro, color: GOLD }}>Month {n} · {billing ? `bills ${fmtDate(billing)}` : ""}</div>
                      <div style={{ fontFamily: SERIF, fontSize: 22, color: CREAM, lineHeight: 1.05 }}>{next ? next.name : "Choose a scent"}</div>
                      {next && <InspiredBy {...referenceOf(next)} size="sm" />}
                      {next && (
                        <div style={{ fontFamily: MONO, fontSize: 11, color: "rgba(243,236,220,0.6)" }}>
                          <span style={{ color: GOLD }}>{money(subscriptionPrice(next, s.format))}</span> · 10% under shelf
                        </div>
                      )}
                    </div>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={micro}>Change next scent</span>
                      <select
                        value={s.nextFragranceId ?? ""}
                        disabled={busy}
                        onChange={(e) => void pick(s, e.target.value)}
                        style={{ background: "#0b0b0d", color: CREAM, border: "1px solid #1f1f27", height: 40, padding: "0 12px", fontFamily: MONO, fontSize: 11.5, minWidth: 220 }}
                      >
                        <option value="" disabled>Pick a fragrance</option>
                        {fragrances.map((f) => (
                          <option key={f.id} value={f.id}>{f.name} — {money(subscriptionPrice(f, s.format))}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <div style={{ marginTop: 22, borderTop: "1px solid #1f1f27", paddingTop: 16 }}>
                  <div style={micro}>Deliveries</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {s.deliveries.map((d) => {
                      const f = fragrances.find((x) => x.id === d.fragranceId);
                      return (
                        <div key={d.id} style={{ display: "grid", gridTemplateColumns: "70px 1fr auto auto", gap: 14, alignItems: "center", fontFamily: MONO, fontSize: 11 }}>
                          <span style={{ color: "rgba(243,236,220,0.5)" }}>Month {d.month}</span>
                          <button style={{ ...btnLink, letterSpacing: 0, textTransform: "none", fontFamily: SERIF, fontSize: 17, color: CREAM }} onClick={() => f && navigate(paths.product(f.slug))}>
                            {f?.name ?? "—"}
                          </button>
                          <span style={{ color: GOLD }}>{money(d.chargeCents)}</span>
                          <span style={{ color: d.status === "delivered" ? "#8bb98a" : "rgba(243,236,220,0.6)" }}>{DELIVERY[d.status]} · {fmtDate(d.billedAt)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {s.status === "active" && (
                  <div style={{ marginTop: 20, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                    {confirmCancel === s.id ? (
                      <>
                        <span style={{ fontSize: 12.5, color: "rgba(243,236,220,0.7)" }}>End the subscription? Months already paid still ship.</span>
                        <button className="mo-ghost" style={{ ...btnGhost, height: 36, color: "#d98a6a", borderColor: "#d98a6a" }} disabled={busy} onClick={() => void cancel(s)}>Yes, cancel</button>
                        <button style={btnLink} onClick={() => setConfirmCancel(null)}>Keep it</button>
                      </>
                    ) : (
                      <button style={{ ...btnLink, color: "rgba(243,236,220,0.5)" }} onClick={() => setConfirmCancel(s.id)}>Cancel subscription</button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
