import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type Fragrance, money } from "../lib/data";
import { bagLines, discoveryProgress, subscribeBag } from "../lib/bag";
import { DISCOVERY_BOX_PRICE, DISCOVERY_BOX_SIZE, sku } from "../lib/formats";
import { navigate, paths } from "../lib/route";
import { Arrow } from "./ui";

const SEEN_KEY = "mo:box-nudge";

/**
 * "Your 5th sample for $2": when an add brings the bag to three or four loose
 * 10 ml bottles, a popup says what finishing the Discovery Box costs. The
 * figures are the real ones — four singles are already 4 × $12, and five make
 * a $50 box, so the fifth adds only the difference. It appears once for each
 * count per visit, only after an add (never after a removal), and closes on
 * Escape, on its buttons, or by tapping outside.
 */
export default function DiscoveryNudge({ fragrances, onOpenBox }: { fragrances: Fragrance[]; onOpenBox: () => void }) {
  const lines = useSyncExternalStore(subscribeBag, bagLines, bagLines);
  const { loose } = discoveryProgress(lines);
  const prev = useRef(loose);
  const [shown, setShown] = useState<number | null>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  // Rose to 3 or 4 by an add: show it, unless already shown for that count this visit.
  useEffect(() => {
    const was = prev.current;
    prev.current = loose;
    if (loose <= was || (loose !== DISCOVERY_BOX_SIZE - 2 && loose !== DISCOVERY_BOX_SIZE - 1)) return;
    let seen: number[] = [];
    try {
      seen = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]");
    } catch {
      /* private mode: show it */
    }
    if (seen.includes(loose)) return;
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen, loose]));
    } catch {
      /* ignore */
    }
    opener.current = document.activeElement;
    // After the bag drawer has opened, so the popup sits on top of it.
    const t = window.setTimeout(() => setShown(loose), 350);
    return () => window.clearTimeout(t);
  }, [loose]);

  const close = () => {
    setShown(null);
    (opener.current as HTMLElement | null)?.focus?.();
  };
  useEffect(() => {
    if (shown == null) return;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown]);

  if (shown == null) return null;

  // What's in the bag now (the loose 10 ml at their prices), and a single's price.
  const byId = new Map(fragrances.map((f) => [f.id, f]));
  const looseLines = lines.filter((l) => l.format === "perf10" && !l.engraving && !l.label);
  const looseCost = looseLines.reduce((n, l) => n + (byId.get(l.fragranceId) ? sku(byId.get(l.fragranceId)!, "perf10").price : 0) * l.qty, 0);
  const first = byId.get(looseLines[0]?.fragranceId ?? "");
  const single = first ? sku(first, "perf10").price : 0;
  const toFinish = DISCOVERY_BOX_PRICE - looseCost; // what the remaining bottles add in all
  const need = DISCOVERY_BOX_SIZE - shown;
  const fifth = need === 1 ? toFinish : toFinish - single * (need - 1);
  // Only when it really is a saving on the single price.
  if (!single || fifth <= 0 || fifth >= single) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mo-nudge-title"
        aria-describedby="mo-nudge-copy"
        className="mo-rise"
        style={{ position: "relative", width: "100%", maxWidth: 420, background: "#f7f3eb", color: "#1b1917", border: "1px solid #c9a961", padding: "26px 24px 22px", boxShadow: "0 30px 70px rgba(0,0,0,0.5)", fontFamily: "'Hanken Grotesk',system-ui,sans-serif" }}
      >
        <button onClick={close} aria-label="Close" style={{ position: "absolute", top: 10, right: 10, width: 40, height: 40, background: "none", border: 0, fontSize: 22, color: "#62594e", cursor: "pointer" }}>×</button>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7a5f26" }}>Discovery Box</p>
        <h2 id="mo-nudge-title" style={{ margin: "8px 0 0", fontFamily: "'Cormorant Garamond',Georgia,serif", fontWeight: 500, fontSize: 32, lineHeight: 1.1 }}>
          {need === 1 ? <>Add one more — it's just {money(fifth)}.</> : <>Add two more — the 5th is just {money(fifth)}.</>}
        </h2>
        <p id="mo-nudge-copy" style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, color: "#4a4136" }}>
          You have {shown} × 10 ml in your bag. Any {DISCOVERY_BOX_SIZE} make a Discovery Box for {money(DISCOVERY_BOX_PRICE)}
          {need === 1 ? `, so your 5th costs ${money(fifth)}.` : `: your 4th is ${money(single)} and your 5th just ${money(fifth)}.`} We apply it automatically.
        </p>
        <div aria-hidden style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {Array.from({ length: DISCOVERY_BOX_SIZE }).map((_, i) => (
            <span key={i} style={{ width: 18, height: 18, borderRadius: "50%", border: "1px solid #c9a961", background: i < shown ? "#c9a961" : "none" }} />
          ))}
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          <button
            ref={primary}
            onClick={() => {
              setShown(null);
              onOpenBox();
              navigate(paths.discovery);
            }}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 50, background: "#1b1917", color: "#f7f3eb", border: 0, fontSize: 16, fontWeight: 600, cursor: "pointer" }}
          >
            Choose {need === 1 ? "my 5th sample" : "2 more samples"} <Arrow />
          </button>
          <button onClick={close} style={{ minHeight: 44, background: "none", border: 0, color: "#765b29", fontSize: 15, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 4, cursor: "pointer" }}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
