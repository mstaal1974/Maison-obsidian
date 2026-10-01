import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { CREAM, GOLD, money } from "../lib/data";
import { type Device, type FunnelStep, type Flow, type Heatmap, type Journey, type JourneyFilter, type Overview, type PageRow, purgeEvents, useReport } from "../lib/siteAnalytics";
import { isExcluded, setExcluded } from "../lib/sitelog";
import { btnGhost, chip, field, label } from "./adminStyles";

const MUTED = "rgba(243,236,220,0.55)";
const FAINT = "rgba(243,236,220,0.35)";
const HAIR = "#1f1f27";
const SERIF = "'Cormorant Garamond',serif";
const MONO = "'Space Mono',monospace";
const h3: CSSProperties = { margin: "0 0 12px", fontFamily: SERIF, fontWeight: 300, fontSize: 24, color: CREAM };
const panel: CSSProperties = { border: `1px solid ${HAIR}`, padding: "18px 20px", background: "#0e0e12" };

type Section = "overview" | "funnel" | "pages" | "journeys" | "heatmaps" | "settings";
const SECTIONS: [Section, string][] = [
  ["overview", "Overview"],
  ["funnel", "Funnel"],
  ["pages", "Pages & paths"],
  ["journeys", "Customer journeys"],
  ["heatmaps", "Heatmaps"],
  ["settings", "Settings"],
];

/** What each recorded event means, in the shop's words. Unlisted ones are skipped in journeys. */
const EVENT_LABEL: Record<string, string> = {
  view_item: "Viewed fragrance",
  add_to_cart: "Added to bag",
  remove_from_cart: "Removed from bag",
  view_cart: "Opened bag",
  begin_checkout: "Started checkout",
  add_shipping_info: "Chose delivery",
  add_payment_info: "Went to payment",
  purchase: "Purchased",
  search: "Searched",
  quiz_start: "Started Scent DNA",
  quiz_complete: "Finished Scent DNA",
  discovery_box_completed: "Filled a Discovery Box",
  subscription_started: "Started Monthly Pour",
};

const fmtSecs = (s: number | null | undefined) => (s == null ? "—" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`);
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);
const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-AU"));

/**
 * Admin: how the storefront is used, from its own event log. Visits, the
 * purchase funnel, which pages lead where, each visit's journey, and click
 * and scroll heatmaps per page. Nothing here identifies a person.
 */
export default function AdminAnalytics({ configured }: { configured: boolean }) {
  const [section, setSection] = useState<Section>("overview");
  const [days, setDays] = useState(30);

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 300, fontSize: 30, color: CREAM }}>Analytics</h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.6, color: "rgba(243,236,220,0.5)", maxWidth: 760 }}>
            The storefront's own record of visits: no third party, nothing that identifies a person. Times are Brisbane time.
            {!configured && " Demo mode: connect Supabase and apply migration 0036 to start recording."}
          </p>
        </div>
        {/* Filters sit in one row above the reports and drive all of them. */}
        <div role="group" aria-label="Date range" style={{ display: "flex", gap: 6 }}>
          {[7, 30, 90, 365].map((d) => (
            <button key={d} onClick={() => setDays(d)} aria-pressed={days === d} style={{ ...chip, cursor: "pointer", background: days === d ? GOLD : "none", color: days === d ? "#0b0b0d" : CREAM }}>
              {d === 365 ? "12 months" : `${d} days`}
            </button>
          ))}
        </div>
      </div>

      <div role="tablist" aria-label="Analytics" style={{ display: "flex", gap: 18, margin: "22px 0 22px", flexWrap: "wrap" }}>
        {SECTIONS.map(([id, text]) => (
          <button
            key={id}
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            style={{ background: "none", border: 0, cursor: "pointer", padding: "0 0 8px", borderBottom: `1px solid ${section === id ? GOLD : "transparent"}`, color: section === id ? GOLD : MUTED, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" }}
          >
            {text}
          </button>
        ))}
      </div>

      {!configured ? (
        <p style={{ fontSize: 13, color: MUTED }}>Nothing is recorded without Supabase. Once it's connected and migration 0036 is applied, visits appear here within a minute.</p>
      ) : section === "overview" ? (
        <OverviewPanel days={days} />
      ) : section === "funnel" ? (
        <FunnelPanel days={days} />
      ) : section === "pages" ? (
        <PagesPanel days={days} />
      ) : section === "journeys" ? (
        <JourneysPanel days={days} />
      ) : section === "heatmaps" ? (
        <HeatmapPanel days={days} />
      ) : (
        <SettingsPanel />
      )}
    </section>
  );
}

function Status({ loading, error }: { loading: boolean; error: string | null }) {
  if (error) return <p style={{ fontSize: 12, color: "#e08a7a" }}>Couldn't load this report ({error}). Has migration 0036 been applied, and is this account an admin?</p>;
  if (loading) return <p style={{ fontSize: 12, color: FAINT }}>Loading…</p>;
  return null;
}

function Stat({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div style={panel}>
      <div style={label}>{title}</div>
      <div style={{ marginTop: 8, fontFamily: SERIF, fontSize: 34, lineHeight: 1, color: CREAM }}>{value}</div>
      {sub && <div style={{ marginTop: 6, fontSize: 11.5, color: FAINT }}>{sub}</div>}
    </div>
  );
}

function OverviewPanel({ days }: { days: number }) {
  const { data, loading, error } = useReport<Overview>("analytics_overview", { p_days: days });
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Status loading={loading} error={error} />
      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            <Stat title="Visits" value={num(data.sessions)} sub={`${num(data.visitors)} visitors`} />
            <Stat title="Conversion" value={pct(data.conversion_rate)} sub={`${num(data.orders)} orders`} />
            <Stat title="Revenue" value={money(Math.round(Number(data.revenue) * 100))} sub="Recorded on the thank-you page" />
            <Stat title="Added to bag" value={pct(data.cart_rate)} sub="of visits" />
            <Stat title="Pages per visit" value={data.pages_per_session == null ? "—" : String(data.pages_per_session)} sub={`Avg ${fmtSecs(data.avg_seconds)} · ${pct(data.bounce_rate)} single-page`} />
          </div>
          <div style={panel}>
            <h3 style={h3}>Visits per day</h3>
            <DailyColumns daily={data.daily} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            <div style={panel}>
              <h3 style={h3}>Where visits come from</h3>
              <BarList rows={data.sources.map((s) => ({ key: s.source, label: s.source, value: s.sessions, note: s.orders ? `${s.orders} ${s.orders === 1 ? "order" : "orders"}` : "" }))} />
            </div>
            <div style={panel}>
              <h3 style={h3}>Devices</h3>
              <BarList rows={data.devices.map((d) => ({ key: d.device, label: d.device, value: d.sessions, note: d.sessions ? `${Math.round((100 * d.orders) / d.sessions * 10) / 10}% convert` : "" }))} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** One series of columns: visits per day. Hover a column for its numbers; the table carries them all. */
function DailyColumns({ daily }: { daily: Overview["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!daily.length) return <p style={{ fontSize: 12, color: FAINT }}>No visits in this period yet.</p>;
  const max = Math.max(1, ...daily.map((d) => d.sessions));
  const H = 160;
  const tick = niceMax(max);
  return (
    <div>
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "34px 1fr", gap: 8 }}>
        <div style={{ position: "relative", height: H, fontFamily: MONO, fontSize: 9, color: FAINT }}>
          <span style={{ position: "absolute", top: -5, right: 0 }}>{tick}</span>
          <span style={{ position: "absolute", bottom: -5, right: 0 }}>0</span>
        </div>
        <div role="img" aria-label={`Visits per day, ${daily.length} days, peak ${max}`} style={{ position: "relative", height: H, borderBottom: `1px solid ${HAIR}`, borderTop: `1px solid ${HAIR}`, display: "flex", alignItems: "flex-end", gap: 2 }}>
          {daily.map((d, i) => (
            <div
              key={d.day}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", cursor: "default" }}
            >
              <div style={{ width: "100%", maxWidth: 24, height: `${(d.sessions / tick) * 100}%`, minHeight: d.sessions ? 2 : 0, background: GOLD, opacity: hover == null || hover === i ? 1 : 0.55, borderRadius: "4px 4px 0 0" }} />
            </div>
          ))}
          {hover != null && (
            <div style={{ position: "absolute", top: 6, left: `${Math.min(80, (hover / daily.length) * 100)}%`, background: "#16161c", border: `1px solid ${HAIR}`, padding: "6px 10px", fontSize: 12, color: CREAM, pointerEvents: "none", whiteSpace: "nowrap" }}>
              {daily[hover].day} · {daily[hover].sessions} visits · {daily[hover].orders} orders
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginLeft: 42, marginTop: 6, fontFamily: MONO, fontSize: 9, color: FAINT }}>
        <span>{daily[0].day}</span>
        <span>{daily[daily.length - 1].day}</span>
      </div>
      <details style={{ marginTop: 10 }}>
        <summary style={{ ...label, cursor: "pointer" }}>Show as table</summary>
        <table style={{ marginTop: 8, borderCollapse: "collapse", fontSize: 12, color: CREAM }}>
          <thead>
            <tr>{["Day", "Visits", "Orders"].map((h) => <th key={h} style={{ ...label, textAlign: "left", padding: "4px 14px 4px 0" }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.day}><td style={{ padding: "3px 14px 3px 0" }}>{d.day}</td><td style={{ padding: "3px 14px 3px 0" }}>{d.sessions}</td><td>{d.orders}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function niceMax(n: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(n)));
  const m = [1, 2, 2.5, 5, 10].find((x) => x * p >= n) ?? 10;
  return m * p;
}

/** Horizontal bars, one series, value at the tip. */
function BarList({ rows }: { rows: { key: string; label: string; value: number; note?: string }[] }) {
  if (!rows.length) return <p style={{ fontSize: 12, color: FAINT }}>Nothing recorded yet.</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: "grid", gap: 9 }}>
      {rows.map((r) => (
        <div key={r.key} style={{ display: "grid", gridTemplateColumns: "minmax(70px, 150px) minmax(40px, 1fr) auto", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, color: CREAM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.label}>{r.label}</span>
          <span style={{ display: "block" }}>
            <span style={{ display: "block", height: 12, width: `${(r.value / max) * 100}%`, minWidth: 2, background: GOLD, borderRadius: "0 4px 4px 0" }} />
          </span>
          <span style={{ whiteSpace: "nowrap" }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: CREAM }}>{num(r.value)}</span>
            {r.note && <span style={{ fontSize: 11, color: FAINT, marginLeft: 8 }}>{r.note}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function FunnelPanel({ days }: { days: number }) {
  const { data, loading, error } = useReport<FunnelStep[]>("analytics_funnel", { p_days: days });
  const top = data?.[0]?.sessions || 0;
  return (
    <div style={panel}>
      <h3 style={h3}>From visit to purchase</h3>
      <p style={{ margin: "-4px 0 16px", fontSize: 12, color: MUTED }}>Visits reaching each step. The drop between two steps is where to look first.</p>
      <Status loading={loading} error={error} />
      {data && (
        <div style={{ display: "grid", gap: 12 }}>
          {data.map((s, i) => {
            const prev = i ? data[i - 1].sessions : s.sessions;
            const keep = prev ? Math.round((100 * s.sessions) / prev) : 0;
            return (
              <div key={s.step} style={{ display: "grid", gridTemplateColumns: "170px 1fr 250px", gap: 14, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: CREAM }}>{s.step}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ height: 18, width: `${top ? (s.sessions / top) * 80 : 0}%`, minWidth: s.sessions ? 2 : 0, background: GOLD, borderRadius: "0 4px 4px 0" }} />
                  <span style={{ fontFamily: MONO, fontSize: 12, color: CREAM }}>{num(s.sessions)}</span>
                </span>
                <span style={{ fontSize: 11.5, color: i ? (keep < 30 ? "#e0a07a" : MUTED) : FAINT }}>
                  {i ? `${keep}% of previous · ${top ? Math.round((1000 * s.sessions) / top) / 10 : 0}% of visits` : "100%"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PagesPanel({ days }: { days: number }) {
  const pages = useReport<PageRow[]>("analytics_pages", { p_days: days });
  const flows = useReport<Flow[]>("analytics_flows", { p_days: days });
  const th: CSSProperties = { ...label, textAlign: "left", padding: "8px 12px 8px 0", borderBottom: `1px solid ${HAIR}`, fontWeight: 400 };
  const td: CSSProperties = { padding: "8px 12px 8px 0", borderBottom: `1px solid #16161c`, fontSize: 12.5, color: CREAM };
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ ...panel, overflowX: "auto" }}>
        <h3 style={h3}>Pages</h3>
        <Status loading={pages.loading} error={pages.error} />
        {pages.data && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Page", "Views", "Visits", "Landed here", "Left from here", "Avg scrolled"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {pages.data.map((p) => (
                <tr key={p.path}>
                  <td style={{ ...td, fontFamily: MONO, fontSize: 11.5 }}>{p.path}</td>
                  <td style={td}>{num(p.views)}</td>
                  <td style={td}>{num(p.sessions)}</td>
                  <td style={td}>{num(p.landings)}</td>
                  <td style={td}>{num(p.exits)} <span style={{ color: FAINT }}>({p.views ? Math.round((100 * p.exits) / p.views) : 0}%)</span></td>
                  <td style={td}>{p.scroll == null ? "—" : `${p.scroll}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={panel}>
        <h3 style={h3}>Most common paths</h3>
        <p style={{ margin: "-4px 0 14px", fontSize: 12, color: MUTED }}>From one page to the next. “(left)” means the visit ended there.</p>
        <Status loading={flows.loading} error={flows.error} />
        {flows.data && (
          <div style={{ display: "grid", gap: 8 }}>
            {flows.data.map((f) => (
              <div key={`${f.from}>${f.to}`} style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr 60px", gap: 10, alignItems: "center", fontFamily: MONO, fontSize: 11.5, color: CREAM }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.from}</span>
                <span style={{ color: GOLD }}>→</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: f.to === "(left)" ? FAINT : CREAM }}>{f.to}</span>
                <span style={{ textAlign: "right" }}>{num(f.count)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function JourneysPanel({ days }: { days: number }) {
  const [filter, setFilter] = useState<JourneyFilter>("purchased");
  const { data, loading, error } = useReport<Journey[]>("analytics_journeys", { p_days: days, p_filter: filter, p_limit: 60 });
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div role="group" aria-label="Which visits" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {([
          ["purchased", "Bought"],
          ["abandoned", "Added to bag, didn't buy"],
          ["carted", "Added to bag"],
          ["all", "All visits"],
        ] as [JourneyFilter, string][]).map(([id, text]) => (
          <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id} style={{ ...chip, cursor: "pointer", background: filter === id ? GOLD : "none", color: filter === id ? "#0b0b0d" : CREAM }}>
            {text}
          </button>
        ))}
      </div>
      <Status loading={loading} error={error} />
      {data && !data.length && <p style={{ fontSize: 12, color: FAINT }}>No visits like this in the period.</p>}
      {data?.map((j) => (
        <div key={j.session} style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 11.5, color: MUTED }}>
            <span>
              {new Date(j.started).toLocaleString("en-AU", { timeZone: "Australia/Brisbane", dateStyle: "medium", timeStyle: "short" })} · {fmtSecs(j.seconds)} · {j.device ?? "unknown device"} · from {j.source ?? "direct"}
            </span>
            <span style={{ color: j.bought ? GOLD : j.carted ? "#e0a07a" : FAINT }}>
              {j.bought ? `Bought${j.revenue ? ` · ${money(Math.round(Number(j.revenue) * 100))}` : ""}` : j.carted ? "Left with items in the bag" : "No purchase"}
            </span>
          </div>
          <ol style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexWrap: "wrap", gap: "6px 4px", alignItems: "center" }}>
            {j.steps
              .filter((s) => s.kind === "page" || EVENT_LABEL[s.name ?? ""])
              .map((s, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {i > 0 && <span aria-hidden style={{ color: FAINT, fontSize: 11 }}>→</span>}
                  {s.kind === "page" ? (
                    <span style={{ fontFamily: MONO, fontSize: 11, color: CREAM, border: `1px solid ${HAIR}`, padding: "3px 7px" }}>{s.path}</span>
                  ) : (
                    <span style={{ fontSize: 11, color: "#0b0b0d", background: s.name === "purchase" ? GOLD : "rgba(201,169,97,0.75)", padding: "3px 7px" }}>
                      {EVENT_LABEL[s.name ?? ""]}
                      {s.value ? ` · ${money(Math.round(Number(s.value) * 100))}` : ""}
                    </span>
                  )}
                </li>
              ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

const WIDTH: Record<Device, number> = { desktop: 1280, tablet: 900, mobile: 390 };

/**
 * Click heatmap over the live page at the device's width, plus how far down
 * visitors scrolled. The page is the current one, so a recent redesign can
 * put old clicks in the wrong place — keep the range short after a change.
 */
function HeatmapPanel({ days }: { days: number }) {
  const pages = useReport<PageRow[]>("analytics_pages", { p_days: days });
  const [path, setPath] = useState("/");
  const [device, setDevice] = useState<Device>("desktop");
  const heat = useReport<Heatmap>("analytics_heatmap", { p_days: days, p_path: path, p_device: device });
  const W = WIDTH[device];
  const [H, setH] = useState(2400);
  const [boxW, setBoxW] = useState(900);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = Math.min(1, boxW / W);

  // Size the frame to the page once it has rendered (same origin, so readable).
  const onLoad = () => {
    let tries = 0;
    const measure = () => {
      const h = frame.current?.contentDocument?.documentElement.scrollHeight ?? 0;
      if (h) setH(Math.min(14000, h));
      if (++tries < 6) window.setTimeout(measure, 700);
    };
    measure();
  };

  const clicks = heat.data?.clicks;
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.width = W;
    c.height = H;
    ctx.clearRect(0, 0, W, H);
    if (!clicks?.length) return;
    // Each click a soft gold spot; overlaps add up, so busy areas glow.
    ctx.globalCompositeOperation = "lighter";
    const r = device === "mobile" ? 22 : 28;
    for (const [x, y] of clicks) {
      const cx = x * W;
      const g = ctx.createRadialGradient(cx, y, 0, cx, y, r);
      g.addColorStop(0, "rgba(255,170,60,0.35)");
      g.addColorStop(1, "rgba(255,170,60,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, y - r, r * 2, r * 2);
    }
  }, [clicks, W, H, device]);

  const paths = useMemo(() => (pages.data ?? []).map((p) => p.path), [pages.data]);
  const sc = heat.data?.scroll;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={label}>Page</span>
          <select value={path} onChange={(e) => setPath(e.target.value)} style={{ ...field, width: 320, background: "#0e0e12" }}>
            {[...new Set(["/", ...paths])].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <div role="group" aria-label="Device" style={{ display: "flex", gap: 6 }}>
          {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
            <button key={d} onClick={() => setDevice(d)} aria-pressed={device === d} style={{ ...chip, cursor: "pointer", background: device === d ? GOLD : "none", color: device === d ? "#0b0b0d" : CREAM, textTransform: "capitalize" }}>
              {d}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11.5, color: FAINT }}>{clicks ? `${clicks.length} clicks` : ""}</span>
      </div>
      <Status loading={heat.loading} error={heat.error} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 260px", gap: 14, alignItems: "start" }} className="mo-heat-grid">
        <div ref={box} style={{ ...panel, padding: 0, overflow: "hidden" }}>
          <div style={{ width: W * scale, height: H * scale, position: "relative", margin: "0 auto" }}>
            <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
              <iframe ref={frame} key={`${path}:${device}`} src={path} title={`Preview of ${path}`} onLoad={onLoad} scrolling="no" tabIndex={-1} style={{ width: W, height: H, border: 0, pointerEvents: "none", opacity: 0.55 }} />
              <canvas ref={canvas} aria-hidden style={{ position: "absolute", inset: 0, width: W, height: H, pointerEvents: "none" }} />
              {/* Scroll reach: where a quarter, half and three quarters of visits stopped. */}
              {sc && sc.visits > 0 &&
                ([25, 50, 75] as const).map((q) => (
                  <div key={q} style={{ position: "absolute", left: 0, right: 0, top: (H * q) / 100, borderTop: "1px dashed rgba(243,236,220,0.5)" }}>
                    <span style={{ position: "absolute", right: 8, top: 4, background: "rgba(11,11,13,0.85)", color: CREAM, fontFamily: MONO, fontSize: 12 / scale > 30 ? 30 : 12 / scale, padding: "2px 6px" }}>
                      {Math.round((100 * sc[`reached${q}`]) / sc.visits)}% reached {q}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={panel}>
            <h3 style={{ ...h3, fontSize: 20 }}>Scrolled to</h3>
            {sc && sc.visits ? (
              <BarList
                rows={[
                  { key: "25", label: "25% of page", value: sc.reached25 },
                  { key: "50", label: "50%", value: sc.reached50 },
                  { key: "75", label: "75%", value: sc.reached75 },
                  { key: "100", label: "The end", value: sc.reached100 },
                ].map((r) => ({ ...r, note: `${Math.round((100 * r.value) / sc.visits)}%` }))}
              />
            ) : (
              <p style={{ fontSize: 12, color: FAINT }}>No scroll data for this page and device yet.</p>
            )}
          </div>
          <div style={panel}>
            <h3 style={{ ...h3, fontSize: 20 }}>Most clicked</h3>
            {heat.data?.labels.length ? (
              <BarList rows={heat.data.labels.map((l) => ({ key: l.label, label: l.label, value: l.clicks }))} />
            ) : (
              <p style={{ fontSize: 12, color: FAINT }}>No clicks on labelled controls yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const [excluded, setExcl] = useState(isExcluded());
  const [purged, setPurged] = useState<string | null>(null);
  const clarity = String(import.meta.env.VITE_CLARITY_ID ?? "").trim();
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 760 }}>
      <div style={panel}>
        <h3 style={h3}>This browser</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, lineHeight: 1.6, color: MUTED }}>
          Leave your own browsing out of the numbers. Applies to this browser only; set it on each device you shop the site from.
        </p>
        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, color: CREAM }}>
          <input
            type="checkbox"
            checked={excluded}
            onChange={(e) => {
              setExcluded(e.target.checked);
              setExcl(e.target.checked);
            }}
          />
          Don't record visits from this browser
        </label>
      </div>
      <div style={panel}>
        <h3 style={h3}>Session recordings</h3>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: MUTED }}>
          {clarity ? (
            <>
              Microsoft Clarity is on. Watch recordings of real visits and its own heatmaps at{" "}
              <a href={`https://clarity.microsoft.com/projects/view/${clarity}/dashboard`} target="_blank" rel="noreferrer" style={{ color: GOLD }}>clarity.microsoft.com</a>.
            </>
          ) : (
            <>For recordings of real visits, add a free Microsoft Clarity project and set VITE_CLARITY_ID in Vercel (see docs/ANALYTICS_SETUP.md).</>
          )}
        </p>
      </div>
      <div style={panel}>
        <h3 style={h3}>Keep 13 months</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, lineHeight: 1.6, color: MUTED }}>Delete events older than 13 months. Old visits aren't needed once the year-on-year comparison is past.</p>
        <button
          style={btnGhost}
          onClick={async () => {
            if (!window.confirm("Delete all events older than 13 months? This can't be undone.")) return;
            const n = await purgeEvents(396);
            setPurged(n == null ? "Couldn't delete — is this account an admin?" : `Deleted ${n.toLocaleString("en-AU")} events.`);
          }}
        >
          Delete older events
        </button>
        {purged && <p style={{ margin: "10px 0 0", fontSize: 12, color: MUTED }}>{purged}</p>}
      </div>
    </div>
  );
}
