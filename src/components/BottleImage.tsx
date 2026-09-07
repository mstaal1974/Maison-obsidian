import { useState, type CSSProperties } from "react";
import { bottleBackdrop } from "./adminStyles";

interface BottleImageProps {
  /** Transparent PNG render (admin upload or /assets/<slug>.png); falls back to the stock bottle photo. */
  imageUrl?: string;
  fallbackSrc: string;
  alt: string;
  accent: string;
  liquid: string;
  /** Height of the frame (card tiles fix it; the product page lets it grow). */
  height?: number | string;
  objectPosition?: string;
  style?: CSSProperties;
}

/**
 * A fragrance's bottle. Uploaded renders are transparent PNGs, so they sit on a
 * dark gradient tinted with the scent's accent and juice colours; the stock
 * photography fills the frame edge to edge as before.
 */
export default function BottleImage({
  imageUrl,
  fallbackSrc,
  alt,
  accent,
  liquid,
  height = "100%",
  objectPosition = "center 30%",
  style,
}: BottleImageProps) {
  // A render that fails to load (no file for this slug yet) drops to the stock
  // photo. Keyed by URL so a later, different image gets its own attempt.
  const [failed, setFailed] = useState<string | null>(null);
  if (!imageUrl || failed === imageUrl) {
    // Stock photography is shot on a light set; a vignette and a touch less
    // brightness sit it into the near-black storefront until real renders land.
    return (
      <div style={{ position: "relative", width: "100%", height, overflow: "hidden", background: "#0e0e12", ...style }}>
        <img
          src={fallbackSrc}
          alt={alt}
          loading="lazy"
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition, filter: "brightness(0.78) saturate(1.05)" }}
        />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(75% 70% at 50% 45%, transparent 35%, rgba(11,11,13,0.8) 100%)" }} />
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height, background: bottleBackdrop(accent, liquid), ...style }}>
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(imageUrl)}
        style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", padding: "6% 10%", boxSizing: "border-box" }}
      />
    </div>
  );
}
