import { useCallback, useEffect, useRef, useState } from "react";
import {
  DIM_SHORT,
  FAMILY_COLOUR,
  identityOf,
  ringPoints,
  type Scentprint,
} from "../../lib/scentdna";
import { MONO, SD, SERIF, ctaGhost, ctaGold, ctaQuiet, eyebrow, glass, goldA, ink, micro } from "./theme";

const W = 1080;
const H = 1350; // Instagram portrait — the format the result is made for.
const HOUSE_DOMAIN = "maisonobsidian.com.au";

interface ShareProps {
  print: Scentprint;
  /** Share link for this result, e.g. https://…/scent/7HD92K */
  url: string;
  code: string;
  /** The closest match, named on the card as proof the result goes somewhere. */
  topMatch?: { name: string; percent: number } | null;
}

/**
 * The shareable Scentprint: a 1080 × 1350 card drawn on canvas from the same
 * ring geometry as the on-page visual, offered through the native Share sheet
 * where the browser has one and as a download everywhere else.
 */
export default function ShareCard({ print, url, code, topMatch }: ShareProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const identity = identityOf(print);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let live = true;
    const paint = () => live && drawCard(canvas, print, topMatch ?? null);
    paint();
    // Repaint once the display faces land, or the card falls back to Georgia.
    if (document.fonts?.ready) void document.fonts.ready.then(paint);
    return () => {
      live = false;
    };
  }, [print, topMatch]);

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  }, []);

  const toBlob = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  }, []);

  const share = useCallback(async () => {
    setBusy(true);
    try {
      const text = `My Scent DNA is ${identity.primary} — ${identity.character.slice(0, 3).join(" · ")}.`;
      const blob = await toBlob();
      const file = blob ? new File([blob], "maison-obsidian-scent-dna.png", { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Scent DNA — Maison Obsidian", text });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: "My Scent DNA — Maison Obsidian", text, url });
        return;
      }
      await copy(url);
      flash("Link copied — paste it anywhere.");
    } catch {
      /* the sheet was dismissed: nothing to report */
    } finally {
      setBusy(false);
    }
  }, [identity, toBlob, url, flash]);

  const download = useCallback(async () => {
    const blob = await toBlob();
    if (!blob) return;
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `maison-obsidian-scent-dna-${code}.png`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 4000);
    flash("Saved to your downloads.");
  }, [toBlob, code, flash]);

  const copyLink = useCallback(async () => {
    flash((await copy(url)) ? "Link copied." : "Copy failed — long-press the link instead.");
  }, [url, flash]);

  return (
    <div className="sd-share-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 320px) 1fr", gap: 34, alignItems: "start" }}>
      <div style={{ ...glass, padding: 12 }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          aria-label={`Your shareable Scentprint card: ${identity.primary}`}
          style={{ display: "block", width: "100%", height: "auto", background: SD.obsidian }}
        />
      </div>
      <div>
        <div style={eyebrow}>Make it yours</div>
        <h3 style={{ margin: "12px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: 34, color: SD.text, lineHeight: 1.1 }}>Share your Scentprint.</h3>
        <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.75, color: ink(0.58), maxWidth: 460 }}>
          Sized 1080 × 1350 for stories and feeds. The link opens your result for anyone who taps it — and only the numbers travel in it, never your name or email.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 26 }}>
          <button className="sd-cta" style={{ ...ctaGold, height: 50 }} onClick={() => void share()} disabled={busy}>
            Share
          </button>
          <button className="sd-cta" style={{ ...ctaGhost, height: 50 }} onClick={() => void download()}>
            Download my Scentprint
          </button>
          <button className="sd-cta" style={{ ...ctaQuiet, height: 50 }} onClick={() => void copyLink()}>
            Copy link
          </button>
        </div>
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <code style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.08em", color: goldA(0.9), border: `1px solid ${goldA(0.24)}`, padding: "8px 12px", wordBreak: "break-all" }}>{url}</code>
          <span style={{ ...micro, color: ink(0.35) }} aria-live="polite">
            {notice ?? ""}
          </span>
        </div>
      </div>
    </div>
  );
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── Canvas ──────────────────────────────────────────────────────────────────

/** Letter-spaced text, drawn by hand so it looks the same in every browser. */
function tracked(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number): void {
  const chars = [...text];
  const width = chars.reduce((s, c) => s + ctx.measureText(c).width + spacing, 0) - spacing;
  let x = cx - width / 2;
  for (const c of chars) {
    ctx.fillText(c, x, y);
    x += ctx.measureText(c).width + spacing;
  }
}

function drawCard(canvas: HTMLCanvasElement, print: Scentprint, topMatch: { name: string; percent: number } | null): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const identity = identityOf(print);
  ctx.clearRect(0, 0, W, H);

  // Ground: obsidian with a navy bloom above and gold warmth below.
  ctx.fillStyle = SD.obsidian;
  ctx.fillRect(0, 0, W, H);
  const top = ctx.createRadialGradient(240, 140, 20, 240, 140, 900);
  top.addColorStop(0, "rgba(15,30,61,0.95)");
  top.addColorStop(1, "rgba(15,30,61,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H);
  const cyan = ctx.createRadialGradient(900, 340, 10, 900, 340, 760);
  cyan.addColorStop(0, "rgba(0,191,255,0.16)");
  cyan.addColorStop(1, "rgba(0,191,255,0)");
  ctx.fillStyle = cyan;
  ctx.fillRect(0, 0, W, H);
  const gold = ctx.createRadialGradient(540, 1380, 40, 540, 1380, 860);
  gold.addColorStop(0, "rgba(201,163,91,0.22)");
  gold.addColorStop(1, "rgba(201,163,91,0)");
  ctx.fillStyle = gold;
  ctx.fillRect(0, 0, W, H);

  // Frame
  ctx.strokeStyle = "rgba(201,163,91,0.42)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(44, 44, W - 88, H - 88);
  ctx.strokeStyle = "rgba(201,163,91,0.14)";
  ctx.strokeRect(62, 62, W - 124, H - 124);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Wordmark
  ctx.fillStyle = SD.text;
  ctx.font = "600 30px 'Cormorant Garamond', Georgia, serif";
  tracked(ctx, "MAISON OBSIDIAN", W / 2, 138, 9);
  ctx.fillStyle = "rgba(201,163,91,0.9)";
  ctx.font = "12px 'Space Mono', monospace";
  tracked(ctx, "SCENTPRINT™", W / 2, 170, 6);

  ctx.strokeStyle = "rgba(201,163,91,0.5)";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 46, 196);
  ctx.lineTo(W / 2 + 46, 196);
  ctx.stroke();

  ctx.fillStyle = SD.text;
  ctx.font = "300 86px 'Cormorant Garamond', Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("My Scent DNA", W / 2, 282);

  // ─── The ring ──────────────────────────────────────────────────────────────
  const cx = W / 2;
  const cy = 636;
  const R = 252;
  const points = ringPoints(identity.top);

  ctx.strokeStyle = "rgba(245,242,234,0.08)";
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach((k) => {
    ctx.beginPath();
    ctx.arc(cx, cy, R * k, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.strokeStyle = "rgba(201,163,91,0.34)";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(245,242,234,0.07)";
  points.forEach((p) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + p.ex * R, cy + p.ey * R);
    ctx.stroke();
  });

  // Fingerprint core
  ctx.lineWidth = 1.1;
  [0.1, 0.155, 0.21, 0.265, 0.32].forEach((k, i) => {
    const rr = R * k;
    const ox = (i % 2 === 0 ? 1 : -1) * rr * 0.09;
    ctx.strokeStyle = `rgba(201,163,91,${0.4 - i * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy, rr, rr * 1.12, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy + rr * 0.08, rr * 0.9, rr, 0, 0, Math.PI);
    ctx.stroke();
  });

  // The print
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = cx + p.x * R;
    const y = cy + p.y * R;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  const fill = ctx.createRadialGradient(cx, cy, 10, cx, cy, R);
  fill.addColorStop(0, "rgba(0,191,255,0.44)");
  fill.addColorStop(0.6, "rgba(0,191,255,0.14)");
  fill.addColorStop(1, "rgba(201,163,91,0.32)");
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.shadowColor = "rgba(201,163,91,0.55)";
  ctx.shadowBlur = 26;
  ctx.strokeStyle = SD.gold;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.restore();

  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(cx + p.x * R, cy + p.y * R, 5.4, 0, Math.PI * 2);
    ctx.fillStyle = FAMILY_COLOUR[p.dim];
    ctx.fill();
  });

  // Ring labels
  ctx.font = "13px 'Space Mono', monospace";
  points.forEach((p) => {
    const lx = cx + p.ex * R * 1.16;
    const ly = cy + p.ey * R * 1.16;
    ctx.textAlign = Math.abs(p.ex) < 0.25 ? "center" : p.ex > 0 ? "left" : "right";
    ctx.fillStyle = p.value >= 60 ? "rgba(230,201,137,0.95)" : "rgba(245,242,234,0.5)";
    ctx.fillText(DIM_SHORT[p.dim].toUpperCase(), lx, ly);
  });

  // ─── The read-out ──────────────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(201,163,91,0.9)";
  ctx.font = "12px 'Space Mono', monospace";
  tracked(ctx, "PRIMARY", cx, 978, 7);

  ctx.fillStyle = SD.text;
  ctx.font = "300 78px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText(identity.primary, cx, 1044);

  ctx.fillStyle = "rgba(245,242,234,0.6)";
  ctx.font = "italic 300 34px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText(identity.secondary, cx, 1088);

  // Four numbers, evenly spread
  const four = identity.top.slice(0, 4);
  const slot = (W - 260) / four.length;
  four.forEach((d, i) => {
    const x = 130 + slot * i + slot / 2;
    ctx.fillStyle = "rgba(245,242,234,0.45)";
    ctx.font = "11px 'Space Mono', monospace";
    tracked(ctx, DIM_SHORT[d.dim].toUpperCase(), x, 1164, 4);
    ctx.fillStyle = SD.softGold;
    ctx.font = "300 46px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText(String(d.value), x, 1208);
  });

  ctx.strokeStyle = "rgba(201,163,91,0.22)";
  ctx.beginPath();
  ctx.moveTo(130, 1232);
  ctx.lineTo(W - 130, 1232);
  ctx.stroke();

  ctx.fillStyle = "rgba(245,242,234,0.6)";
  ctx.font = "12px 'Space Mono', monospace";
  tracked(ctx, identity.character.join("  •  ").toUpperCase(), cx, 1258, 4);

  if (topMatch) {
    ctx.fillStyle = "rgba(0,191,255,0.85)";
    ctx.font = "12px 'Space Mono', monospace";
    tracked(ctx, `CLOSEST MATCH · ${topMatch.percent}% ${topMatch.name.toUpperCase()}`, cx, 1120, 3);
  }

  ctx.fillStyle = "rgba(201,163,91,0.85)";
  ctx.font = "13px 'Space Mono', monospace";
  // Always the house's own address: a card screenshotted from a preview build
  // or a staging host still has to send people somewhere that exists.
  tracked(ctx, `DISCOVER YOURS AT ${HOUSE_DOMAIN.toUpperCase()}`, cx, 1284, 5);
}
