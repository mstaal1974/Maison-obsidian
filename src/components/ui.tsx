// Small shared components for the storefront: imagery with graceful
// fallbacks, captions, chips and the line icons used across the redesign.
import { type CSSProperties, type ReactNode, useState } from "react";
import { GOLD, CREAM, HAIRLINE } from "../lib/data";
import { MONO, SERIF, micro } from "./styles";

export const Arrow = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M1 6h10M6.5 1.5 11 6l-4.5 4.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

export function Container({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px", ...style }}>{children}</div>;
}

export function Rule() {
  return <div style={{ height: 1, background: HAIRLINE }} />;
}

/**
 * Photography slot. Tries `src` (an asset from the design comp that may not be
 * dropped into public/assets yet) and falls back to a stock shot, always over a
 * dark gradient so the layout holds even without imagery.
 */
export function Art({
  src,
  fallback = "/assets/bottle-pair.png",
  alt = "",
  position = "center",
  style,
  overlay = "linear-gradient(90deg, rgba(11,11,13,0.9) 0%, rgba(11,11,13,0.35) 45%, rgba(11,11,13,0.15) 100%)",
  children,
}: {
  src: string;
  fallback?: string;
  alt?: string;
  position?: string;
  style?: CSSProperties;
  overlay?: string | null;
  children?: ReactNode;
}) {
  const [cur, setCur] = useState(src);
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "radial-gradient(70% 60% at 60% 50%, #2a1d10 0%, #0e0e12 70%)", ...style }}>
      <img
        src={cur}
        alt={alt}
        loading="lazy"
        onError={() => cur !== fallback && setCur(fallback)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: position, opacity: cur === fallback ? 0.5 : 1, filter: cur === fallback ? "brightness(0.7)" : undefined }}
      />
      {overlay && <div aria-hidden style={{ position: "absolute", inset: 0, background: overlay }} />}
      {children}
    </div>
  );
}

/** Vertical mono caption used at the edges of hero / product layouts. */
export function SideCaption({ lines, style }: { lines: string[]; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      {lines.map((l, i) =>
        l === "—" ? (
          <span key={i} style={{ display: "block", width: 34, height: 1, background: "rgba(201,169,97,0.6)", margin: "16px 0" }} />
        ) : (
          <span key={i} style={{ ...micro, color: i < lines.indexOf("—") || !lines.includes("—") ? GOLD : "rgba(243,236,220,0.6)", letterSpacing: "0.34em" }}>
            {l}
          </span>
        ),
      )}
    </div>
  );
}

export type IconName = "flame" | "moon" | "star" | "hourglass" | "tree" | "sun" | "drop" | "leaf" | "bag" | "search" | "heart" | "truck" | "refresh" | "play" | "lock";

export function Icon({ name, size = 18, color = GOLD }: { name: IconName; size?: number; color?: string }) {
  const p = { fill: "none", stroke: color, strokeWidth: 1.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "flame":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 1-6 1-9z" /></svg>;
    case "moon":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" /></svg>;
    case "star":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="m12 3 2.6 5.6 6 .7-4.4 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.4 9.3l6-.7z" /></svg>;
    case "hourglass":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M7 3h10M7 21h10M8 3c0 5 4 6 4 9s-4 4-4 9M16 3c0 5-4 6-4 9s4 4 4 9" /></svg>;
    case "tree":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M12 3 7 10h3l-4 6h5v5h2v-5h5l-4-6h3z" /></svg>;
    case "sun":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></svg>;
    case "drop":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" /></svg>;
    case "leaf":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M4 20c0-9 6-15 16-16-1 10-7 16-16 16zM4 20c4-5 8-8 12-10" /></svg>;
    case "bag":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" /></svg>;
    case "search":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>;
    case "heart":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>;
    case "truck":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.5" /><circle cx="17" cy="18" r="1.5" /></svg>;
    case "refresh":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>;
    case "lock":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><rect x="4.5" y="10" width="15" height="10.5" rx="1.6" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
    case "play":
      return <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="m9 6 9 6-9 6z" /></svg>;
  }
}

/** Ring-icon + label used in the product page experience row. */
export function IconBadge({ name, label }: { name: IconName; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
      <span style={{ width: 44, height: 44, border: "1px solid rgba(201,169,97,0.6)", borderRadius: "50%", display: "grid", placeItems: "center" }}>
        <Icon name={name} />
      </span>
      <span style={{ fontFamily: SERIF, fontSize: 15, color: CREAM }}>{label}</span>
    </div>
  );
}

/** "10ml · 30ml · 50ml · CAR" chip row. */
export function Chip({ children, active, onClick, tone = "cream", style }: { children: ReactNode; active?: boolean; onClick?: () => void; tone?: "cream" | "gold"; style?: CSSProperties }) {
  // Static chips render as spans so they can sit inside other buttons.
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        boxSizing: "border-box",
        background: active ? "rgba(201,169,97,0.14)" : "none",
        border: `1px solid ${active || tone === "gold" ? "rgba(201,169,97,0.7)" : "rgba(243,236,220,0.28)"}`,
        color: active || tone === "gold" ? GOLD : "rgba(243,236,220,0.85)",
        cursor: onClick ? "pointer" : "default",
        height: 26,
        padding: "0 10px",
        fontFamily: MONO,
        fontSize: 9.5,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/**
 * The reference fragrance, made prominent on every tile: a gold band that
 * reads "Inspired by · Tom Ford — Black Lacquer" so shoppers who search by the
 * scent they already know spot it instantly. The house name still leads.
 */
export function InspiredBy({ brand, fragrance, size = "md", style }: { brand: string; fragrance: string; size?: "sm" | "md" | "lg"; style?: CSSProperties }) {
  const px = size === "lg" ? 28 : size === "md" ? 21 : 19;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid rgba(201,169,97,0.75)",
        borderLeft: `4px solid ${GOLD}`,
        background: "linear-gradient(90deg, rgba(201,169,97,0.22), rgba(201,169,97,0.06))",
        padding: size === "lg" ? "10px 16px 11px 14px" : "8px 12px 9px 10px",
        ...style,
      }}
    >
      <span style={{ ...micro, color: GOLD, fontSize: size === "lg" ? 9.5 : 8.5, letterSpacing: "0.32em", whiteSpace: "nowrap" }}>Inspired by</span>
      <span style={{ fontFamily: SERIF, fontSize: px, lineHeight: 1.1, color: GOLD, fontWeight: 600, letterSpacing: "0.01em" }}>
        {brand}
        {fragrance ? <span style={{ opacity: 0.7, fontWeight: 400 }}> — </span> : null}
        {fragrance ? <span style={{ fontStyle: "italic", fontWeight: 500, color: "#f1dfae" }}>{fragrance}</span> : null}
      </span>
    </div>
  );
}
