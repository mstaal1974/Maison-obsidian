import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GOLD, moneyExact } from "../lib/data";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  DEMO_PASS,
  addressLines,
  downloadCsv,
  forgetPass,
  formatLabel,
  itemCount,
  loadOrders,
  matchesFilter,
  recallPass,
  rememberPass,
  searchOrders,
  setPacked,
  setTracking,
  trackingUrl,
  type DeskFilter,
  type StaffOrder,
} from "../lib/staffDesk";
import { btnGhost, btnGold, field, label } from "./adminStyles";

/**
 * The staff order desk. Paid orders, a tick box for packed, a field for the
 * Australia Post article id, a printable pack list and printable address
 * labels — the four things someone standing at a bench with a roll of tape
 * actually needs.
 *
 * Production uses individual Supabase accounts and staff membership (0027).
 * The passphrase UI is only used for local demo data.
 */
export default function StaffDesk({ onSignOut }: { onSignOut: () => void }) {
  const [pass, setPass] = useState(() => isSupabaseConfigured ? "account-session" : recallPass());
  const [typed, setTyped] = useState("");
  const [orders, setOrders] = useState<StaffOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<DeskFilter>("to_pack");
  const [query, setQuery] = useState("");

  const refresh = useCallback(
    async (withPass: string) => {
      setBusy(true);
      const res = await loadOrders(withPass);
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        setOrders(null);
        return false;
      }
      setError(null);
      setOrders(res.value);
      return true;
    },
    [],
  );

  // A remembered passphrase reopens the desk without asking again. The load is
  // kicked off from a timeout rather than the effect body so the first render
  // is not chased by a synchronous state write.
  useEffect(() => {
    if (!pass) return;
    const id = window.setTimeout(() => void refresh(pass), 0);
    return () => window.clearTimeout(id);
  }, [pass, refresh]);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = typed.trim();
    if (!candidate) return;
    if (await refresh(candidate)) {
      rememberPass(candidate);
      setPass(candidate);
      setTyped("");
    }
  };

  const lock = () => {
    forgetPass();
    if (isSupabaseConfigured) { setOrders(null); onSignOut(); return; }
    setPass("");
    setOrders(null);
    setError(null);
  };

  const shown = useMemo(
    () => (orders ? searchOrders(orders, query).filter((o) => matchesFilter(o, filter)) : []),
    [orders, query, filter],
  );

  if (isSupabaseConfigured && !orders) {
    return <main style={{padding: 32, color: "#f3ecdc"}}><h1>Staff order desk</h1><p>{busy ? "Loading orders…" : error || "Checking staff access…"}</p><p>Your individual account must be authorised for order fulfilment.</p><button onClick={() => void refresh("account-session")}>Retry</button><a href="#/">Return to shop</a></main>;
  }
  if (!pass || !orders) {
    return <Gate typed={typed} onTyped={setTyped} onSubmit={unlock} error={error} busy={busy} />;
  }

  return (
    <>
      <Desk
        orders={orders}
        shown={shown}
        pass={pass}
        filter={filter}
        query={query}
        busy={busy}
        error={error}
        onFilter={setFilter}
        onQuery={setQuery}
        onRefresh={() => void refresh(pass)}
        onLock={lock}
        onChanged={(next) => setOrders(next)}
      />
      {/* Both print sheets live in the page and are invisible until printing;
          building them in a popup is the version browsers block. */}
      <PackList orders={shown} />
      <Labels orders={shown} />
    </>
  );
}

// ─── The passphrase gate ─────────────────────────────────────────────────────

function Gate({
  typed,
  onTyped,
  onSubmit,
  error,
  busy,
}: {
  typed: string;
  onTyped: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
  busy: boolean;
}) {
  return (
    <main
      className="mo-screen"
      data-screen-label="Staff desk — locked"
      style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#0b0b0d" }}
    >
      <form onSubmit={onSubmit} style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ ...label, color: "rgba(201,169,97,0.85)", letterSpacing: "0.28em" }}>Maison Obsidian</div>
        <h1 style={{ margin: "12px 0 0", fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 40, color: "#f3ecdc" }}>
          Order desk
        </h1>
        <p style={{ margin: "10px 0 22px", fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.5)" }}>
          {isSupabaseConfigured
            ? "Enter the staff passphrase to see today's orders."
            : `Demo mode — this browser has no database behind it. The passphrase is “${DEMO_PASS}”.`}
        </p>
        <input
          type="password"
          value={typed}
          onChange={(e) => onTyped(e.target.value)}
          placeholder="Passphrase"
          autoFocus
          autoComplete="current-password"
          aria-label="Staff passphrase"
          style={{ ...field, height: 46 }}
        />
        <button type="submit" disabled={busy || !typed.trim()} style={{ ...btnGold, width: "100%", height: 46, marginTop: 12, opacity: busy || !typed.trim() ? 0.5 : 1 }}>
          {busy ? "Checking…" : "Open the desk"}
        </button>
        {error && (
          <p role="alert" style={{ margin: "14px 0 0", fontSize: 12, color: "#e0736f" }}>
            {error}
          </p>
        )}
      </form>
    </main>
  );
}

// ─── The desk ────────────────────────────────────────────────────────────────

const FILTERS: { key: DeskFilter; label: string }[] = [
  { key: "to_pack", label: "To pack" },
  { key: "no_tracking", label: "No tracking" },
  { key: "packed", label: "Packed" },
  { key: "all", label: "All" },
];

function Desk({
  orders,
  shown,
  pass,
  filter,
  query,
  busy,
  error,
  onFilter,
  onQuery,
  onRefresh,
  onLock,
  onChanged,
}: {
  orders: StaffOrder[];
  shown: StaffOrder[];
  pass: string;
  filter: DeskFilter;
  query: string;
  busy: boolean;
  error: string | null;
  onFilter: (f: DeskFilter) => void;
  onQuery: (q: string) => void;
  onRefresh: () => void;
  onLock: () => void;
  onChanged: (next: StaffOrder[]) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // Printing: mark the body, let the browser paint, then open the dialog. The
  // mark is cleared on afterprint — and on a timer too, because a cancelled
  // dialog does not always fire it.
  const printTimer = useRef<number | null>(null);
  useEffect(() => {
    const clear = () => {
      delete document.body.dataset.print;
    };
    window.addEventListener("afterprint", clear);
    return () => {
      window.removeEventListener("afterprint", clear);
      if (printTimer.current) window.clearTimeout(printTimer.current);
      clear();
    };
  }, []);

  const print = (mode: "list" | "labels") => {
    document.body.dataset.print = mode;
    if (printTimer.current) window.clearTimeout(printTimer.current);
    printTimer.current = window.setTimeout(() => {
      window.print();
      printTimer.current = window.setTimeout(() => delete document.body.dataset.print, 1000);
    }, 80);
  };

  const apply = (ref: string, change: (o: StaffOrder) => StaffOrder) =>
    onChanged(orders.map((o) => (o.order_ref === ref ? change(o) : o)));

  const togglePacked = async (order: StaffOrder) => {
    const next = !order.packed;
    // Optimistic: the tick has to answer the finger immediately, and it is put
    // back if the write fails.
    apply(order.order_ref, (o) => ({ ...o, packed: next }));
    setSaving(order.order_ref);
    const res = await setPacked(pass, order.order_ref, next);
    setSaving(null);
    if (!res.ok) {
      apply(order.order_ref, (o) => ({ ...o, packed: !next }));
      setFailed(res.error);
    } else {
      setFailed(null);
    }
  };

  const saveTracking = async (order: StaffOrder, value: string) => {
    const clean = value.trim();
    if (clean === (order.tracking_number ?? "")) return;
    setSaving(order.order_ref);
    const res = await setTracking(pass, order.order_ref, clean);
    setSaving(null);
    if (!res.ok) {
      setFailed(res.error);
      return;
    }
    setFailed(null);
    apply(order.order_ref, (o) => ({ ...o, tracking_number: clean || null }));
  };

  const toPack = orders.filter((o) => !o.packed).length;
  const awaiting = orders.filter((o) => o.packed && !o.tracking_number).length;

  return (
    <main className="mo-screen" data-screen-label="Staff desk" style={{ minHeight: "100vh", background: "#0b0b0d", padding: "34px 26px 80px" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ ...label, color: "rgba(201,169,97,0.85)", letterSpacing: "0.28em" }}>Maison Obsidian · Order desk</div>
            <h1 style={{ margin: "10px 0 0", fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 42, color: "#f3ecdc" }}>
              {toPack} to pack
              {awaiting > 0 && <span style={{ fontSize: 20, color: "rgba(243,236,220,0.45)" }}> · {awaiting} awaiting tracking</span>}
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btnGhost} onClick={onRefresh} disabled={busy}>
              {busy ? "Loading…" : "Refresh"}
            </button>
            <button style={btnGhost} onClick={() => print("list")} disabled={!shown.length}>
              Print pack list
            </button>
            <button style={btnGhost} onClick={() => print("labels")} disabled={!shown.length}>
              Print labels
            </button>
            <button style={btnGhost} onClick={() => downloadCsv(shown)} disabled={!shown.length}>
              Export CSV
            </button>
            <button style={btnGhost} onClick={onLock}>
              Lock
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "22px 0 16px" }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => onFilter(f.key)}
              style={{
                ...btnGhost,
                height: 32,
                padding: "0 14px",
                borderColor: filter === f.key ? GOLD : "#1f1f27",
                color: filter === f.key ? GOLD : "rgba(243,236,220,0.6)",
              }}
            >
              {f.label}
            </button>
          ))}
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search name, email, postcode, scent, ref…"
            aria-label="Search orders"
            style={{ ...field, height: 32, width: 320 }}
          />
          <span style={{ ...label }}>
            {shown.length} of {orders.length} {orders.length === 1 ? "order" : "orders"}
          </span>
          {!isSupabaseConfigured && <span style={{ ...label, color: "rgba(224,115,111,0.9)" }}>Demo data</span>}
        </div>

        {(failed || error) && (
          <p role="alert" style={{ margin: "0 0 14px", fontSize: 12, color: "#e0736f" }}>
            {failed ?? error}
          </p>
        )}

        {shown.length === 0 ? (
          <p style={{ fontSize: 13, color: "rgba(243,236,220,0.5)" }}>Nothing here. Try another filter.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {shown.map((o) => (
              <OrderRow
                key={o.order_ref}
                order={o}
                saving={saving === o.order_ref}
                onTogglePacked={() => void togglePacked(o)}
                onSaveTracking={(v) => void saveTracking(o, v)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function OrderRow({
  order,
  saving,
  onTogglePacked,
  onSaveTracking,
}: {
  order: StaffOrder;
  saving: boolean;
  onTogglePacked: () => void;
  onSaveTracking: (value: string) => void;
}) {
  // The field is the source of truth while it is being typed into, and follows
  // the order again whenever the saved value changes underneath it (a refresh,
  // or another packer). Adjusting during render rather than in an effect keeps
  // the cursor where it is.
  const [tracking, setTrackingValue] = useState(order.tracking_number ?? "");
  const [saved, setSaved] = useState(order.tracking_number ?? "");
  if (saved !== (order.tracking_number ?? "")) {
    setSaved(order.tracking_number ?? "");
    setTrackingValue(order.tracking_number ?? "");
  }

  const lines = addressLines(order);
  const placed = new Date(order.placed_at);

  return (
    <article
      className="mo-desk-row"
      style={{
        display: "grid",
        gridTemplateColumns: "44px 108px minmax(220px, 1.4fr) 96px minmax(170px, 1fr) minmax(190px, 1fr) 200px",
        gap: 14,
        alignItems: "start",
        border: `1px solid ${order.packed ? "rgba(201,169,97,0.3)" : "#1f1f27"}`,
        background: order.packed ? "rgba(201,169,97,0.04)" : "rgba(255,255,255,0.012)",
        padding: "14px 16px",
      }}
    >
      <label style={{ display: "grid", placeItems: "center", cursor: "pointer", paddingTop: 2 }}>
        <input
          type="checkbox"
          checked={order.packed}
          onChange={onTogglePacked}
          aria-label={`Packed — order ${order.order_ref}`}
          style={{ width: 20, height: 20, accentColor: GOLD, cursor: "pointer" }}
        />
        <span style={{ ...label, fontSize: 7.5, marginTop: 5 }}>{saving ? "…" : "Packed"}</span>
      </label>

      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "rgba(243,236,220,0.6)", lineHeight: 1.6 }}>
        {placed.toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
        <br />
        <span style={{ color: "rgba(243,236,220,0.35)" }}>{placed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        {order.items.map((i, n) => (
          <div key={`${i.fragrance_id}-${n}`} style={{ fontSize: 12.5, color: "#f3ecdc", lineHeight: 1.45 }}>
            <span style={{ color: GOLD, fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{i.qty}×</span>{" "}
            {i.name ?? i.fragrance_id}{" "}
            <span style={{ ...label, fontSize: 9 }}>{formatLabel(i.format, i.size_ml)}</span>
            {i.engraving && <div style={{ ...label, fontSize: 9, color: "rgba(201,169,97,0.8)" }}>Engraved · {i.engraving}</div>}
            {i.inspiration && <div style={{ fontSize: 10.5, color: "rgba(243,236,220,0.32)" }}>{i.inspiration}</div>}
          </div>
        ))}
      </div>

      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, color: "rgba(243,236,220,0.8)" }}>{moneyExact(order.amount_cents)}</div>

      <div style={{ fontSize: 12, color: "rgba(243,236,220,0.75)", lineHeight: 1.55, wordBreak: "break-word" }}>
        {order.ship_name && <div>{order.ship_name}</div>}
        {order.email && <div style={{ fontSize: 11, color: "rgba(243,236,220,0.45)" }}>{order.email}</div>}
        {order.ship_phone && <div style={{ fontSize: 11, color: "rgba(243,236,220,0.45)" }}>{order.ship_phone}</div>}
      </div>

      <div style={{ fontSize: 12, color: "rgba(243,236,220,0.7)", lineHeight: 1.5 }}>
        <div style={{ ...label, fontSize: 8, color: order.delivery_method === "alternate" ? "rgba(224,115,111,0.9)" : "rgba(243,236,220,0.4)" }}>
          {order.delivery_method === "alternate" ? "Alternate delivery" : "Australia Post"}
        </div>
        {lines.length ? lines.map((l, n) => <div key={n}>{l}</div>) : <span style={{ color: "rgba(243,236,220,0.35)" }}>No address on the order</span>}
        {order.ship_notes && <div style={{ marginTop: 4, fontSize: 11, color: "rgba(201,169,97,0.75)" }}>{order.ship_notes}</div>}
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <input
          value={tracking}
          onChange={(e) => setTrackingValue(e.target.value)}
          onBlur={() => onSaveTracking(tracking)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="AusPost article id"
          aria-label={`Tracking number — order ${order.order_ref}`}
          style={{ ...field, height: 34, fontSize: 11 }}
        />
        {order.tracking_number && (
          <a
            href={trackingUrl(order.tracking_number)}
            target="_blank"
            rel="noreferrer"
            style={{ ...label, fontSize: 8.5, color: "rgba(201,169,97,0.85)", textDecoration: "none" }}
          >
            Track this parcel →
          </a>
        )}
        <span style={{ ...label, fontSize: 8, color: "rgba(243,236,220,0.3)", wordBreak: "break-all" }}>{order.order_ref}</span>
      </div>
    </article>
  );
}

// ─── Print: the pack list ────────────────────────────────────────────────────

function PackList({ orders }: { orders: StaffOrder[] }) {
  return (
    <section className="mo-print mo-print-list" aria-hidden>
      <h1 className="mo-print-title">
        Maison Obsidian — pack list
        <span>
          {new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })} · {orders.length} {orders.length === 1 ? "order" : "orders"}
        </span>
      </h1>
      {orders.map((o) => (
        <article key={o.order_ref} className="mo-pack">
          <header>
            <strong>{o.ship_name ?? o.email ?? "Customer"}</strong>
            <span>
              {itemCount(o)} {itemCount(o) === 1 ? "piece" : "pieces"} · {moneyExact(o.amount_cents)} · {o.order_ref}
            </span>
          </header>
          <table>
            <tbody>
              {o.items.map((i, n) => (
                <tr key={`${i.fragrance_id}-${n}`}>
                  <td className="tick">☐</td>
                  <td className="qty">{i.qty}</td>
                  <td>
                    {i.name ?? i.fragrance_id} <em>{formatLabel(i.format, i.size_ml)}</em>
                    {i.engraving && <div className="engrave">Engrave: {i.engraving}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer>
            {addressLines(o).join(" · ") || "No address on the order"}
            {o.ship_notes ? ` — ${o.ship_notes}` : ""}
          </footer>
        </article>
      ))}
    </section>
  );
}

// ─── Print: the address labels ───────────────────────────────────────────────

// The sender block. Set VITE_RETURN_ADDRESS (lines separated by "|") in the
// Vercel project and in .env locally. Nothing is guessed here on purpose: a
// plausible-looking wrong return address is how an undelivered parcel stops
// coming back, so an unset one prints as a warning the packer cannot miss.
const RETURN_ADDRESS = (import.meta.env.VITE_RETURN_ADDRESS as string | undefined)?.trim();
const RETURN_LINES = RETURN_ADDRESS ? RETURN_ADDRESS.split("|").map((l) => l.trim()).filter(Boolean) : [];

function Labels({ orders }: { orders: StaffOrder[] }) {
  return (
    <section className="mo-print mo-print-labels" aria-hidden>
      {orders.map((o) => (
        <article key={o.order_ref} className="mo-label">
          <div className="from">
            {RETURN_LINES.length ? (
              RETURN_LINES.map((l, n) => <div key={n}>{l}</div>)
            ) : (
              <strong>Return address not set — VITE_RETURN_ADDRESS</strong>
            )}
          </div>
          <div className="to">
            {addressLines(o).map((l, n) => (
              <div key={n} className={n === 0 ? "who" : undefined}>
                {l}
              </div>
            ))}
            {!addressLines(o).length && <div className="who">No address on the order</div>}
          </div>
          <div className="foot">
            <span>{o.order_ref}</span>
            <span>
              {itemCount(o)} {itemCount(o) === 1 ? "piece" : "pieces"}
            </span>
            <span>{o.tracking_number ? `AP ${o.tracking_number}` : "No tracking yet"}</span>
          </div>
        </article>
      ))}
    </section>
  );
}
