import type { CSSProperties } from "react";
import { bottleBackdrop } from "./adminStyles";

interface BottleImageProps {
  /** Admin-uploaded transparent PNG; falls back to the stock bottle photo. */
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
  if (!imageUrl) {
    return (
      <img
        src={fallbackSrc}
        alt={alt}
        loading="lazy"
        style={{ display: "block", width: "100%", height, objectFit: "cover", objectPosition, ...style }}
      />
    );
  }
  return (
    <div style={{ width: "100%", height, background: bottleBackdrop(accent, liquid), ...style }}>
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", padding: "6% 10%", boxSizing: "border-box" }}
      />
    </div>
  );
}
