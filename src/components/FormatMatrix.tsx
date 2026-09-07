import { type CSSProperties, useMemo, useState } from "react";
import { type Fragrance, type FormatKey, type FormatStatus, money } from "../lib/data";
import { FORMATS, formatPrice, formatStatus, sku as skuOf } from "../lib/formats";
import { adminSetFormats, adminSetFormatsAll, adminSetStock, type FormatPatch } from "../lib/admin";
import { label, field, btnGold, btnGhost } from "./adminStyles";

interface FormatMatrixProps {
  fragrances: Fragrance[];
  configured: boolean;
  onReload: () => void;
}

const STATUS_LABEL: Record<FormatStatus, string> = { live: "Live", coming_soon: "Coming soon", hidden: "Hidden" };
const STATUS_COLOR: Record<FormatStatus, string> = { live: "#8bb98a", coming_soon: "#c9a961", hidden: "rgba(243,236,220,0.35)" };

interface Draft {
  stock: Partial<Record<FormatKey, number>>;
  status: Partial<Record<FormatKey, FormatStatus>>;
  price: Partial<Record<FormatKey, number | null>>;
}

const cellStyle: CSSProperties = { padding: "8px 6px", borderBottom: "1px solid #1f1f27", verticalAlign: "top", minWidth: 96 };

/**
 * The product matrix: every fragrance × every format on one screen, with
 * stock, launch status and price per cell, plus bulk actions across the range.
 * Bundles (the Ritual) show derived availability — min of their parts.
 */
export default function FormatMatrix({ fragrances, configured, onReload }: FormatMatrixProps) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkPrice, setBulkPrice] = useState<{ key: FormatKey; dollars: string }>({ key: "perf30", dollars: "" });
  const [note, setNote] = useState<string | null>(null);

  const draft = (id: string): Draft => drafts[id] ?? { stock: {}, status: {}, price: {} };
  const patch = (id: string, fn: (d: Draft) => Draft) => setDrafts((p) => ({ ...p, [id]: fn(draft(id)) }));
  const dirty = (id: string) => {
    const d = drafts[id];
    return !!d && (Object.keys(d.stock).length + Object.keys(d.status).length + Object.keys(d.price).length > 0);
  };

  const stockOf = (f: Fragrance, k: FormatKey) => draft(f.id).stock[k] ?? skuOf(f, k).stock;
  const statusOf = (f: Fragrance, k: FormatKey) => draft(f.id).status[k] ?? formatStatus(f, k);
  const priceOf = (f: Fragrance, k: FormatKey) => {
    const d = draft(f.id).price[k];
    return d === undefined ? formatPrice(f, k) : d ?? formatPrice({ ...f, formatPrices: {} }, k);
  };

  const saveRow = async (f: Fragrance) => {
    const d = draft(f.id);
    setBusy(f.id);
    const p: FormatPatch = { status: d.status, prices: d.price, stock: { car: d.stock.car, wash: d.stock.wash, moist: d.stock.moist } };
    const ok1 = await adminSetFormats(f.id, p);
    const ok2 =
      d.stock.perf10 !== undefined || d.stock.perf30 !== undefined || d.stock.perf50 !== undefined
        ? await adminSetStock(f.id, d.stock.perf10 ?? f.stock10 ?? 0, d.stock.perf30 ?? f.stock30 ?? 0, d.stock.perf50 ?? f.stock50 ?? 0)
        : true;
    setBusy(null);
    if (ok1 && ok2) {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[f.id];
        return next;
      });
      if (configured) onReload();
    } else setNote(`Couldn't save ${f.name}.`);
  };

  const bulk = async (labelText: string, p: FormatPatch) => {
    setBusy("bulk");
    const ok = await adminSetFormatsAll(fragrances.map((f) => f.id), p);
    setBusy(null);
    setNote(ok ? `${labelText} — applied to ${fragrances.length} fragrances.` : `${labelText} failed for some fragrances.`);
    if (configured) onReload();
  };

  const totals = useMemo(
    () =>
      FORMATS.map((d) => ({
        key: d.key,
        live: fragrances.filter((f) => formatStatus(f, d.key) === "live").length,
        stock: fragrances.reduce((s, f) => s + skuOf(f, d.key).stock, 0),
      })),
    [fragrances],
  );

  const select = (f: Fragrance, k: FormatKey) => (
    <select
      aria-label={`${f.name} ${k} status`}
      value={statusOf(f, k)}
      onChange={(e) => patch(f.id, (d) => ({ ...d, status: { ...d.status, [k]: e.target.value as FormatStatus } }))}
      style={{ ...field, appearance: "auto", height: 26, fontSize: 9.5, padding: "0 4px", color: STATUS_COLOR[statusOf(f, k)], borderColor: "#1f1f27" }}
    >
      {(Object.keys(STATUS_LABEL) as FormatStatus[]).map((s) => (
        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
      ))}
    </select>
  );

  return (
    <div>
      {/* Bulk actions */}
      <div style={{ border: "1px solid rgba(201,169,97,0.35)", background: "rgba(20,20,26,0.5)", padding: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ ...label, color: "rgba(201,169,97,0.85)", marginRight: 6 }}>Bulk actions</span>
        <button style={{ ...btnGhost, height: 34 }} disabled={busy === "bulk"} onClick={() => void bulk("Car diffuser enabled", { status: { car: "live" } })}>Enable car diffuser for all</button>
        <button style={{ ...btnGhost, height: 34 }} disabled={busy === "bulk"} onClick={() => void bulk("Body range marked coming soon", { status: { wash: "coming_soon", moist: "coming_soon", ritual: "coming_soon" } })}>Mark body range coming soon</button>
        <button style={{ ...btnGhost, height: 34 }} disabled={busy === "bulk"} onClick={() => void bulk("Body range launched", { status: { wash: "live", moist: "live", ritual: "live" } })}>Launch body range</button>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 6 }}>
          <select aria-label="Format to reprice" value={bulkPrice.key} onChange={(e) => setBulkPrice((b) => ({ ...b, key: e.target.value as FormatKey }))} style={{ ...field, appearance: "auto", height: 34, width: 130, fontSize: 10 }}>
            {FORMATS.filter((d) => d.key !== "ritual").map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
          <input aria-label="New price in dollars" type="number" min={0} placeholder="$" value={bulkPrice.dollars} onChange={(e) => setBulkPrice((b) => ({ ...b, dollars: e.target.value }))} style={{ ...field, height: 34, width: 80 }} />
          <button
            style={{ ...btnGold, height: 34 }}
            disabled={busy === "bulk" || !bulkPrice.dollars}
            onClick={() => void bulk(`${bulkPrice.key} priced at $${bulkPrice.dollars}`, { prices: { [bulkPrice.key]: Math.round(Number(bulkPrice.dollars) * 100) } })}
          >
            Change price for all
          </button>
        </span>
      </div>
      {note && (
        <p role="status" style={{ margin: "12px 0 0", fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#c9a961" }}>{note}</p>
      )}

      <div style={{ overflowX: "auto", marginTop: 18 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 980 }}>
          <thead>
            <tr>
              <th style={{ ...cellStyle, ...label, textAlign: "left", minWidth: 190 }}>Fragrance</th>
              {FORMATS.map((d) => {
                const t = totals.find((x) => x.key === d.key)!;
                return (
                  <th key={d.key} style={{ ...cellStyle, ...label, textAlign: "left" }}>
                    {d.label}
                    <div style={{ marginTop: 3, fontSize: 8, color: "rgba(243,236,220,0.35)", letterSpacing: "0.1em", textTransform: "none" }}>{t.live} live · {t.stock} units</div>
                  </th>
                );
              })}
              <th style={cellStyle} />
            </tr>
          </thead>
          <tbody>
            {fragrances.map((f) => (
              <tr key={f.id} style={{ background: dirty(f.id) ? "rgba(201,169,97,0.04)" : "none" }}>
                <td style={cellStyle}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19, color: "#f3ecdc", lineHeight: 1 }}>{f.name}</div>
                  <div style={{ ...label, fontSize: 8, marginTop: 4 }}>{f.gender} · {f.slug.toUpperCase()}</div>
                </td>
                {FORMATS.map((d) => {
                  const k = d.key;
                  const derived = k === "ritual";
                  const s = statusOf(f, k);
                  return (
                    <td key={k} style={cellStyle}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {derived ? (
                          <span title="Derived: min of 50ml, wash, moisturiser" style={{ ...field, height: 26, width: 48, display: "grid", placeItems: "center", fontSize: 11, color: "rgba(243,236,220,0.6)", borderStyle: "dashed" }}>
                            {stockOf(f, k) === Infinity ? 0 : stockOf(f, k)}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            aria-label={`${f.name} ${d.label} stock`}
                            value={stockOf(f, k)}
                            onChange={(e) => patch(f.id, (dr) => ({ ...dr, stock: { ...dr.stock, [k]: Math.max(0, Number(e.target.value)) } }))}
                            style={{ ...field, height: 26, width: 52, padding: "0 6px", fontSize: 11, color: stockOf(f, k) <= (f.lowStock ?? 5) ? "#d98a6a" : "#f3ecdc" }}
                          />
                        )}
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[s], flexShrink: 0 }} aria-hidden />
                      </div>
                      <div style={{ marginTop: 4 }}>{select(f, k)}</div>
                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: "rgba(243,236,220,0.45)" }}>$</span>
                        {derived ? (
                          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: "rgba(243,236,220,0.6)" }}>{money(priceOf(f, k)).slice(1)} <s style={{ opacity: 0.5 }}>{money(skuOf(f, k).compareAt ?? 0).slice(1)}</s></span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            aria-label={`${f.name} ${d.label} price`}
                            value={Math.round(priceOf(f, k) / 100)}
                            onChange={(e) => patch(f.id, (dr) => ({ ...dr, price: { ...dr.price, [k]: Math.round(Number(e.target.value) * 100) } }))}
                            style={{ ...field, height: 24, width: 56, padding: "0 6px", fontSize: 10 }}
                          />
                        )}
                      </div>
                    </td>
                  );
                })}
                <td style={{ ...cellStyle, minWidth: 70 }}>
                  <button onClick={() => void saveRow(f)} disabled={!dirty(f.id) || busy === f.id} style={{ ...btnGhost, height: 30, padding: "0 12px", opacity: dirty(f.id) ? 1 : 0.4 }}>
                    {busy === f.id ? "…" : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 11.5, lineHeight: 1.6, color: "rgba(243,236,220,0.45)" }}>
        Stock per cell · status dot: <span style={{ color: STATUS_COLOR.live }}>live</span> / <span style={{ color: STATUS_COLOR.coming_soon }}>coming soon</span> (shown with “Notify me”) / <span style={{ color: STATUS_COLOR.hidden }}>hidden</span>. The Ritual set has no stock of its own — it can be fulfilled as many times as its scarcest part, and goes live only when 50ml, wash and moisturiser are all live.
      </p>
    </div>
  );
}
