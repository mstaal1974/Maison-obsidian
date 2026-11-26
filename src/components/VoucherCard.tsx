import { useRef, type CSSProperties } from "react";

import { GIFT_FORMATS, type SubscriptionGiftPlan } from "../../api/_lib/subscription-gift-plan";

export type VoucherFinish = "obsidian" | "alabaster";

export interface VoucherFace {
  amountCents: number;
  subscriptionGift?: SubscriptionGiftPlan;
  to: string;
  from: string;
  message: string;
  /** The real code once issued; null on the preview. */
  code: string | null;
  issuedAt: Date;
  expiresAt: Date;
  finish: VoucherFinish;
}

const CINZEL = "'Cinzel', 'Cormorant Garamond', serif";
const CORMORANT = "'Cormorant Garamond', serif";

const fmtDate = (d: Date) => d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
const fmtMoney = (cents: number) => `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/**
 * The gift voucher as a card: front (value, who it's for, the note) and back
 * (the code, dates, terms), flipping in 3D. A pointer tilts it slightly and
 * moves a foil highlight across it. Two cardstocks: Obsidian Noir and
 * Alabaster Silk. `printable` lays both faces out flat for printing.
 */
export default function VoucherCard({ v, flipped, onFlip, printable = false }: { v: VoucherFace; flipped: boolean; onFlip?: () => void; printable?: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const t = TONES[v.finish];

  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !stage.current || !tilt.current) return;
    const r = stage.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    tilt.current.style.transform = `rotateX(${((0.5 - y) * 10).toFixed(2)}deg) rotateY(${((x - 0.5) * 10).toFixed(2)}deg)`;
    stage.current.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    stage.current.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
  };
  const leave = () => {
    if (tilt.current) tilt.current.style.transform = "";
    stage.current?.style.setProperty("--mx", "50%");
    stage.current?.style.setProperty("--my", "40%");
  };

  const front = <Front v={v} t={t} />;
  const back = <Back v={v} t={t} />;

  if (printable) {
    return (
      <div className="mo-voucher-print" aria-hidden="true">
        <div className={`mo-vface mo-v-${v.finish}`}>{front}</div>
        <div className={`mo-vface mo-v-${v.finish}`}>{back}</div>
      </div>
    );
  }

  return (
    <div
      ref={stage}
      className="mo-vstage"
      onPointerMove={move}
      onPointerLeave={leave}
      onClick={onFlip}
      role={onFlip ? "button" : undefined}
      tabIndex={onFlip ? 0 : undefined}
      aria-label={onFlip ? (flipped ? "Show the front of the voucher" : "Show the back of the voucher") : undefined}
      onKeyDown={(e) => onFlip && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onFlip())}
    >
      <div ref={tilt} className="mo-vtilt">
        <div className={`mo-vflip${flipped ? " is-flipped" : ""}`}>
          <div className={`mo-vface mo-v-${v.finish}`} aria-hidden={flipped}>
            <div className="mo-vsheen" />
            {front}
          </div>
          <div className={`mo-vface mo-vback mo-v-${v.finish}`} aria-hidden={!flipped}>
            <div className="mo-vsheen" />
            {back}
          </div>
        </div>
      </div>
    </div>
  );
}

interface Tone {
  ink: string;
  soft: string;
  gold: string;
  rule: string;
  frame: string;
  inner: string;
  foil: string;
}

const TONES: Record<VoucherFinish, Tone> = {
  obsidian: {
    ink: "#F5F2EB",
    soft: "rgba(245,242,235,0.78)",
    gold: "rgba(223,193,109,0.9)",
    rule: "rgba(212,175,55,0.22)",
    frame: "rgba(212,175,55,0.55)",
    inner: "rgba(212,175,55,0.3)",
    foil: "linear-gradient(135deg,#BF953F 0%,#FCF6BA 25%,#D4AF37 50%,#FBF5B7 75%,#AA771C 100%)",
  },
  alabaster: {
    ink: "#111114",
    soft: "rgba(17,17,20,0.85)",
    gold: "#7A5915",
    rule: "rgba(17,17,20,0.25)",
    frame: "rgba(17,17,20,0.75)",
    inner: "rgba(122,89,21,0.6)",
    foil: "linear-gradient(135deg,#4A3306 0%,#7A5915 30%,#5E430D 55%,#8C6619 80%,#3D2904 100%)",
  },
};

const foilText = (t: Tone): CSSProperties => ({ background: t.foil, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" });
const label = (t: Tone): CSSProperties => ({ fontFamily: CINZEL, fontSize: "clamp(5px, 1.3cqw, 9px)", letterSpacing: "0.28em", textTransform: "uppercase", color: t.gold, fontWeight: 600 });

function Frame({ t, children }: { t: Tone; children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", inset: "3.2%", border: `1px solid ${t.frame}`, borderRadius: 8, padding: "1%" }}>
      <div style={{ position: "relative", height: "100%", border: `1px solid ${t.inner}`, borderRadius: 5, padding: "4.5% 6%", display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
        {(["tl", "tr", "bl", "br"] as const).map((c) => (
          <svg key={c} aria-hidden viewBox="0 0 24 24" fill="none" style={{ position: "absolute", width: "4%", minWidth: 14, color: t.gold, ...(c[0] === "t" ? { top: 4 } : { bottom: 4 }), ...(c[1] === "l" ? { left: 4 } : { right: 4 }), transform: `scale(${c[1] === "r" ? -1 : 1}, ${c[0] === "b" ? -1 : 1})` }}>
            <path d="M1 12V1H12M1 6H6V1M4 4L9 9" stroke="currentColor" strokeWidth="1.15" />
          </svg>
        ))}
        {children}
      </div>
    </div>
  );
}

function Crest({ t }: { t: Tone }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <span style={{ height: 1, width: "9%", background: `linear-gradient(to right, transparent, ${t.gold})` }} />
      <svg aria-hidden viewBox="0 0 32 32" fill="none" style={{ width: "3.6%", minWidth: 14, color: t.gold }}>
        <polygon points="16,2 30,16 16,30 2,16" stroke="currentColor" strokeWidth="1.3" />
        <text x="16" y="19" textAnchor="middle" fill="currentColor" fontFamily="Cinzel, serif" fontSize="8.5" fontWeight="600">MO</text>
      </svg>
      <span style={{ height: 1, width: "9%", background: `linear-gradient(to left, transparent, ${t.gold})` }} />
    </div>
  );
}

function Front({ v, t }: { v: VoucherFace; t: Tone }) {
  return (
    <Frame t={t}>
      <svg aria-hidden viewBox="0 0 100 100" fill="none" style={{ position: "absolute", inset: 0, margin: "auto", width: "42%", color: t.gold, opacity: 0.06, pointerEvents: "none" }}>
        <polygon points="50,4 96,50 50,96 4,50" stroke="currentColor" strokeWidth="1.2" />
        <polygon points="50,14 86,50 50,86 14,50" stroke="currentColor" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="24" stroke="currentColor" strokeWidth="0.8" />
      </svg>
      <div style={{ textAlign: "center", position: "relative" }}>
        <Crest t={t} />
        <div style={{ ...foilText(t), fontFamily: CINZEL, fontWeight: 600, fontSize: "clamp(10px, 4.2cqw, 28px)", letterSpacing: "0.26em", marginTop: 4, lineHeight: 1.1 }}>MAISON OBSIDIAN</div>
        <div style={{ ...label(t), marginTop: 4, fontWeight: 500 }}>Hand-poured in Brisbane</div>
      </div>
      <div style={{ textAlign: "center", position: "relative" }}>
        <div style={{ fontFamily: CINZEL, fontSize: "clamp(6.5px, 1.8cqw, 12px)", letterSpacing: "0.36em", textTransform: "uppercase", color: t.soft }}>
          <span style={{ color: t.gold }}>◆</span> {v.subscriptionGift ? "Monthly Pour Gift Card" : "Gift Voucher"} <span style={{ color: t.gold }}>◆</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6, marginTop: "1%" }}>
          <span style={{ ...foilText(t), fontFamily: CINZEL, fontWeight: 600, fontSize: "clamp(18px, 7cqw, 46px)", letterSpacing: "0.06em", lineHeight: 1 }}>{v.subscriptionGift ? `${v.subscriptionGift.months} months` : fmtMoney(v.amountCents)}</span>
          {!v.subscriptionGift && <span style={{ ...label(t), fontSize: "clamp(6px, 1.7cqw, 12px)" }}>AUD</span>}
        </div>
        {v.subscriptionGift && <div style={{ ...label(t), marginTop: "1%" }}>{GIFT_FORMATS[v.subscriptionGift.format].label}</div>}
        <div style={{ ...label(t), marginTop: "2.4%" }}>Presented to</div>
        <div style={{ fontFamily: CINZEL, fontSize: "clamp(10px, 3.4cqw, 22px)", letterSpacing: "0.12em", color: t.ink, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 4%" }}>{v.to || "Valued Guest"}</div>
        <div style={{ width: "26%", height: 1, margin: "3px auto 0", background: `linear-gradient(to right, transparent, ${t.gold}, transparent)` }} />
        {v.message && (
          <p style={{ margin: "2% auto 0", maxWidth: "82%", fontFamily: CORMORANT, fontStyle: "italic", fontSize: "clamp(8px, 2.3cqw, 15.5px)", lineHeight: 1.3, color: t.soft, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            “{v.message}”
          </p>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderTop: `1px solid ${t.rule}`, paddingTop: "1.4%", position: "relative" }}>
        <div>
          <div style={label(t)}>Compliments of</div>
          <div style={{ fontFamily: CINZEL, fontSize: "clamp(6.5px, 1.7cqw, 11px)", letterSpacing: "0.12em", color: t.ink }}>{v.from || "A Friend"}</div>
        </div>
        <div className="mo-vdomain" style={{ ...label(t), letterSpacing: "0.22em", textTransform: "lowercase" }}>maisonobsidian.com.au</div>
        <div style={{ textAlign: "right" }}>
          <div style={label(t)}>Code</div>
          <div style={{ fontFamily: CINZEL, fontSize: "clamp(6.5px, 1.7cqw, 11px)", letterSpacing: "0.14em", color: t.ink }}>{v.subscriptionGift && v.code ? "See reverse" : v.code ?? "Issued on purchase"}</div>
        </div>
      </div>
    </Frame>
  );
}

function Back({ v, t }: { v: VoucherFace; t: Tone }) {
  return (
    <Frame t={t}>
      <div style={{ textAlign: "center", borderBottom: `1px solid ${t.rule}`, paddingBottom: "2%" }}>
        {/* Solid, not foil: background-clip:text paints as a block on a back-facing 3D face in Chromium. */}
        <div style={{ color: t.gold, fontFamily: CINZEL, fontWeight: 600, fontSize: "clamp(8px, 2.4cqw, 15px)", letterSpacing: "0.3em" }}>MAISON OBSIDIAN</div>
        <div style={{ ...label(t), marginTop: 2, fontWeight: 500 }}>{v.subscriptionGift ? "Monthly Pour gift · redemption" : "Gift voucher · redemption"}</div>
      </div>
      <div style={{ textAlign: "center", display: "grid", justifyItems: "center", gap: "4%" }}>
        <p style={{ margin: 0, maxWidth: "86%", fontFamily: CORMORANT, fontSize: "clamp(8px, 2.3cqw, 15px)", lineHeight: 1.45, color: t.soft }}>
          {v.subscriptionGift ? <>Go to <strong style={{ color: t.gold }}>maisonobsidian.com.au/subscription-gift</strong> and choose Redeem a Monthly Pour gift.</> : <>Shop at <strong style={{ color: t.gold }}>maisonobsidian.com.au</strong> and enter this code as the promotion code on the payment page.</>}
        </p>
        <div style={{ border: `1px solid ${t.frame}`, background: t === TONES.obsidian ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.7)", borderRadius: 6, padding: "1.8% 6%", minWidth: "55%" }}>
          <div style={label(t)}>Your code</div>
          <div style={{ fontFamily: CINZEL, fontWeight: 600, fontSize: v.subscriptionGift ? "clamp(8px, 2.6cqw, 18px)" : "clamp(10px, 3.4cqw, 22px)", letterSpacing: v.subscriptionGift ? "0.04em" : "0.2em", color: t.ink, marginTop: 2 }}>{v.code ?? "MO-····-····"}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", width: "82%", textAlign: "center" }}>
          {[
            ["Issued", fmtDate(v.issuedAt)],
            [v.subscriptionGift ? "Term" : "Value", v.subscriptionGift ? `${v.subscriptionGift.months} months` : `${fmtMoney(v.amountCents)} AUD`],
            ["Valid until", fmtDate(v.expiresAt)],
          ].map(([k, val], i) => (
            <div key={k} style={i === 1 ? { borderLeft: `1px solid ${t.rule}`, borderRight: `1px solid ${t.rule}` } : undefined}>
              <div style={label(t)}>{k}</div>
              <div style={{ fontFamily: CINZEL, fontSize: "clamp(6.5px, 1.7cqw, 12px)", letterSpacing: "0.1em", color: i === 1 ? t.gold : t.ink, fontWeight: i === 1 ? 600 : 400 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
      <p style={{ margin: 0, borderTop: `1px solid ${t.rule}`, paddingTop: "1.6%", textAlign: "center", fontSize: "clamp(5px, 1.3cqw, 8.5px)", lineHeight: 1.5, color: t.soft, opacity: 0.8 }}>
        {v.subscriptionGift ? "Redeem during the three-year validity period. Monthly deliveries are prepaid and end after the final delivery." : "Valid for three years from issue. Use it in one order — any amount left over isn't kept. Not redeemable for cash."}
      </p>
    </Frame>
  );
}
