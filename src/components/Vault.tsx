import { type Fragrance, type Filter, GOLD, shade, money, pad, matches } from "../lib/data";
import FragranceCard from "./FragranceCard";

interface VaultProps {
  fragrances: Fragrance[];
  filter: Filter;
  direction: "gallery" | "ledger";
  vip: boolean;
  showInspiration: boolean;
  effective: (f: Fragrance) => number;
  onFilter: (f: Filter) => void;
  onOpen: (slug: string) => void;
}

const TABS: { id: Filter; label: string; eyebrow: string }[] = [
  { id: "all", label: "All", eyebrow: "Full Collection" },
  { id: "men", label: "For Him", eyebrow: "Men's" },
  { id: "women", label: "For Her", eyebrow: "Women's" },
];

export default function Vault({
  fragrances,
  filter,
  direction,
  vip,
  showInspiration,
  effective,
  onFilter,
  onOpen,
}: VaultProps) {
  const visible = fragrances.filter((f) => matches(f, filter));

  return (
    <section id="mo-vault" style={{ maxWidth: 1340, margin: "0 auto", padding: "84px 32px 30px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 32,
          borderBottom: "1px solid #1f1f27",
          paddingBottom: 30,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Space Mono',monospace",
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "rgba(201,169,97,0.85)",
            }}
          >
            The Vault — Current Pour
          </div>
          <h2
            style={{
              margin: "14px 0 0",
              fontFamily: "'Cormorant Garamond',serif",
              fontWeight: 300,
              fontSize: 50,
              lineHeight: 1.04,
              color: "#f3ecdc",
            }}
          >
            Open batches, <span style={{ fontStyle: "italic", color: "#c9a961" }}>awaiting commits.</span>
          </h2>
        </div>
        <p style={{ maxWidth: 330, fontSize: 13, lineHeight: 1.7, color: "rgba(243,236,220,0.52)" }}>
          Each fragrance is poured only when its batch reaches threshold. Your card is held — never charged — until then.
        </p>
      </div>

      <div
        style={{
          marginTop: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div role="tablist" style={{ display: "flex", border: "1px solid #1f1f27" }}>
          {TABS.map((t) => {
            const active = filter === t.id;
            const count = pad(fragrances.filter((f) => matches(f, t.id)).length);
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => onFilter(t.id)}
                style={{
                  background: active ? GOLD : "transparent",
                  color: active ? "#0b0b0d" : "rgba(243,236,220,0.7)",
                  border: 0,
                  borderRight: "1px solid #1f1f27",
                  cursor: "pointer",
                  padding: "13px 24px",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "block", fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", opacity: 0.7 }}>
                  {t.eyebrow}
                </span>
                <span style={{ display: "block", marginTop: 4, fontFamily: "'Cormorant Garamond',serif", fontSize: 19 }}>
                  {t.label}{" "}
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, opacity: 0.55 }}>{count}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {direction === "gallery" ? (
        <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 22 }} className="mo-vault-grid">
          {visible.map((f) => (
            <FragranceCard
              key={f.id}
              frag={f}
              effectiveCommitted={effective(f)}
              vip={vip}
              showInspiration={showInspiration}
              onOpen={() => onOpen(f.slug)}
            />
          ))}
        </div>
      ) : (
        <Ledger all={fragrances} visible={visible} showInspiration={showInspiration} effective={effective} onOpen={onOpen} />
      )}
    </section>
  );
}

function Ledger({
  all,
  visible,
  showInspiration,
  effective,
  onOpen,
}: {
  all: Fragrance[];
  visible: Fragrance[];
  showInspiration: boolean;
  effective: (f: Fragrance) => number;
  onOpen: (slug: string) => void;
}) {
  const cols = "54px 1.5fr 1.4fr 150px 110px 44px";
  return (
    <div style={{ marginTop: 34, borderTop: "1px solid #1f1f27" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          gap: 18,
          padding: "13px 8px",
          fontFamily: "'Space Mono',monospace",
          fontSize: 9.5,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(243,236,220,0.4)",
          borderBottom: "1px solid #1f1f27",
        }}
      >
        <span>No.</span>
        <span>Fragrance</span>
        <span>Composition</span>
        <span>Batch</span>
        <span style={{ textAlign: "right" }}>Price</span>
        <span />
      </div>
      {visible.map((f) => {
        const eff = effective(f);
        const pct = Math.min(100, Math.round((eff / f.moq) * 100));
        const met = eff >= f.moq;
        const idx = pad(all.indexOf(f) + 1);
        return (
          <button
            key={f.id}
            className="mo-row"
            onClick={() => onOpen(f.slug)}
            style={{
              width: "100%",
              textAlign: "left",
              background: "none",
              border: 0,
              borderBottom: "1px solid #1f1f27",
              cursor: "pointer",
              padding: "22px 8px",
              display: "grid",
              gridTemplateColumns: cols,
              gap: 18,
              alignItems: "center",
            }}
          >
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: "#c9a961" }}>{idx}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  width: 8,
                  height: 52,
                  flexShrink: 0,
                  background: `linear-gradient(180deg, ${shade(f.liquid, 0.25)}, ${f.liquid} 55%, ${shade(f.liquid, -0.5)})`,
                }}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, color: "#f3ecdc", lineHeight: 1 }}>
                    {f.name}
                  </span>
                  {f.vipOnly && (
                    <span
                      style={{
                        fontFamily: "'Space Mono',monospace",
                        fontSize: 8.5,
                        letterSpacing: "0.16em",
                        color: "#c9a961",
                        border: "1px solid rgba(201,169,97,0.4)",
                        padding: "2px 6px",
                      }}
                    >
                      VIP
                    </span>
                  )}
                  {met && (
                    <span
                      style={{
                        fontFamily: "'Space Mono',monospace",
                        fontSize: 8.5,
                        letterSpacing: "0.16em",
                        color: "#0b0b0d",
                        background: "#c9a961",
                        padding: "2px 6px",
                        fontWeight: 700,
                      }}
                    >
                      MET
                    </span>
                  )}
                </span>
                {showInspiration && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 5,
                      fontSize: 10,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "rgba(243,236,220,0.42)",
                    }}
                  >
                    {f.inspiration}
                  </span>
                )}
              </span>
            </span>
            <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "rgba(243,236,220,0.6)" }}>{f.tagline}</span>
            <span>
              <span
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "'Space Mono',monospace",
                  fontSize: 9.5,
                  color: "rgba(243,236,220,0.5)",
                  marginBottom: 6,
                }}
              >
                <span>
                  {eff} / {f.moq}
                </span>
                <span style={{ color: "#c9a961" }}>{pct}%</span>
              </span>
              <span style={{ display: "block", height: 2, background: "#1f1f27" }}>
                <span style={{ display: "block", height: "100%", width: `${pct}%`, background: GOLD }} />
              </span>
            </span>
            <span style={{ textAlign: "right", fontFamily: "'Space Mono',monospace", fontSize: 15, color: "#f3ecdc" }}>
              {money(f.price)}
            </span>
            <span style={{ display: "flex", justifyContent: "flex-end" }}>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
                <path d="M1 6h13M9 1l5 5-5 5" stroke="#c9a961" strokeWidth="1.3" />
              </svg>
            </span>
          </button>
        );
      })}
    </div>
  );
}
