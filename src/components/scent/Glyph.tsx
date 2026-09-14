import type { GlyphName } from "../../lib/scentQuiz";

/**
 * Abstract line art for the discovery cards: one hairline drawing per answer.
 * Deliberately geometric — a material or a horizon, never an icon of a thing.
 */
export default function Glyph({ name, size = 46, color = "currentColor", opacity = 1 }: { name: GlyphName; size?: number; color?: string; opacity?: number }) {
  const p = {
    fill: "none" as const,
    stroke: color,
    strokeWidth: 0.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ opacity, overflow: "visible" }}>
      {glyph(name, p)}
    </svg>
  );
}

type Pen = {
  fill: "none";
  stroke: string;
  strokeWidth: number;
  strokeLinecap: "round";
  strokeLinejoin: "round";
};

function glyph(name: GlyphName, p: Pen) {
  switch (name) {
    case "wave":
      return (
        <g {...p}>
          <path d="M2 9c2.4 0 2.4 2 4.8 2S9.2 9 11.6 9s2.4 2 4.8 2 2.4-2 4.8-2" />
          <path d="M2 13.5c2.4 0 2.4 2 4.8 2s2.4-2 4.8-2 2.4 2 4.8 2 2.4-2 4.8-2" opacity="0.7" />
          <path d="M2 18c2.4 0 2.4 2 4.8 2s2.4-2 4.8-2 2.4 2 4.8 2 2.4-2 4.8-2" opacity="0.4" />
        </g>
      );
    case "rain":
      return (
        <g {...p}>
          <path d="M5 2v20M12 2v20M19 2v20" opacity="0.35" />
          <path d="M8.2 4.5l-2.4 6M15.2 7l-2.4 6M21.4 3.5L19 9.5M8.2 14l-2.4 6M15.2 16l-2.4 6" />
        </g>
      );
    case "arch":
      return (
        <g {...p}>
          <path d="M5 22V11a7 7 0 0 1 14 0v11" />
          <path d="M8.5 22v-9.5a3.5 3.5 0 0 1 7 0V22" opacity="0.55" />
          <path d="M2 22h20" />
        </g>
      );
    case "tumbler":
      return (
        <g {...p}>
          <path d="M6.5 6h11l-1.4 14.2a1.6 1.6 0 0 1-1.6 1.4H9.5a1.6 1.6 0 0 1-1.6-1.4z" />
          <path d="M7.4 13.5h9.2" opacity="0.6" />
          <circle cx="12" cy="17.4" r="2.1" opacity="0.75" />
        </g>
      );
    case "frost":
      return (
        <g {...p}>
          <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" />
          <path d="M9.4 4.6 12 7.2l2.6-2.6M9.4 19.4 12 16.8l2.6 2.6" opacity="0.7" />
        </g>
      );
    case "ember":
      return (
        <g {...p}>
          <path d="M12 21c-3.6 0-6-2.3-6-5.4C6 12 12 9.5 12 3c0 6.5 6 9 6 12.6 0 3.1-2.4 5.4-6 5.4z" />
          <path d="M12 21c-1.8 0-3-1.3-3-3 0-2.1 3-3.3 3-6.6 0 3.3 3 4.5 3 6.6 0 1.7-1.2 3-3 3z" opacity="0.6" />
        </g>
      );
    case "eclipse":
      return (
        <g {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 0 0 18 6.4 6.4 0 0 1 0-18z" opacity="0.75" />
          <circle cx="12" cy="12" r="4.2" opacity="0.35" />
        </g>
      );
    case "sunburst":
      return (
        <g {...p}>
          <circle cx="12" cy="12" r="4.6" />
          <path d="M12 1.5v3.4M12 19.1v3.4M1.5 12h3.4M19.1 12h3.4M4.6 4.6l2.4 2.4M17 17l2.4 2.4M4.6 19.4 7 17M17 7l2.4-2.4" opacity="0.7" />
        </g>
      );
    case "rose":
      return (
        <g {...p}>
          <path d="M12 12a2.4 2.4 0 1 1 2.4 2.4A4.2 4.2 0 0 1 10.2 10a6 6 0 0 1 6-6 7.8 7.8 0 0 1 7.8 7.8" transform="translate(-2 0) scale(0.92)" />
          <path d="M12 16.6V22" opacity="0.6" />
        </g>
      );
    case "fern":
      return (
        <g {...p}>
          <path d="M12 22C12 12 12 6 12 2" />
          <path d="M12 6c-2.4-1.4-4.2-1.2-5.4.6M12 6c2.4-1.4 4.2-1.2 5.4.6M12 11c-2.8-1.6-4.8-1.4-6.2.7M12 11c2.8-1.6 4.8-1.4 6.2.7M12 16c-2.2-1.3-3.8-1.1-4.9.5M12 16c2.2-1.3 3.8-1.1 4.9.5" opacity="0.75" />
        </g>
      );
    case "blossom":
      return (
        <g {...p}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="12" cy="7.4" rx="2.5" ry="4.6" transform={`rotate(${a} 12 12)`} opacity="0.8" />
          ))}
          <circle cx="12" cy="12" r="1.4" />
        </g>
      );
    case "cedar":
      return (
        <g {...p}>
          <path d="M12 2 6.6 10h10.8zM12 8.4 5 17.4h14zM12 22v-4" />
          <path d="M9 22h6" opacity="0.6" />
        </g>
      );
    case "shirt":
      return (
        <g {...p}>
          <path d="M8.6 3 12 6.6 15.4 3l4.6 2.4V22H4V5.4z" />
          <path d="M12 6.6V22" opacity="0.45" />
          <path d="M8.6 3 12 6.6 15.4 3" />
        </g>
      );
    case "suit":
      return (
        <g {...p}>
          <path d="M8 3 4 5.6V22h16V5.6L16 3l-4 5.4z" />
          <path d="M8 3l4 5.4M16 3l-4 5.4" />
          <path d="M12 12.6V22" opacity="0.4" />
          <circle cx="12" cy="14.6" r="0.7" />
        </g>
      );
    case "linen":
      return (
        <g {...p}>
          <path d="M3 7.5c3 0 3-1.4 6-1.4s3 1.4 6 1.4 3-1.4 6-1.4M3 12c3 0 3-1.4 6-1.4s3 1.4 6 1.4 3-1.4 6-1.4M3 16.5c3 0 3-1.4 6-1.4s3 1.4 6 1.4 3-1.4 6-1.4" />
          <path d="M7 4v16M12 4v16M17 4v16" opacity="0.3" />
        </g>
      );
    case "leather":
      return (
        <g {...p}>
          <path d="M6 3.6 12 7l6-3.4L21 6v15H3V6z" />
          <path d="M12 7v14" opacity="0.5" strokeDasharray="1.4 1.8" />
          <path d="M6 3.6 9 9M18 3.6 15 9" opacity="0.7" />
        </g>
      );
    case "obsidian":
      return (
        <g {...p}>
          <path d="M12 2 3.6 8.4 6.4 20 17.6 21.4 21 7.6z" />
          <path d="M12 2 6.4 20M12 2l5.6 19.4M3.6 8.4 21 7.6M6.4 20 21 7.6" opacity="0.45" />
        </g>
      );
    case "seaglass":
      return (
        <g {...p}>
          <path d="M12 3c5.6 0 9 3.4 9 8.4 0 5.6-4 9.6-9 9.6s-9-3.4-9-8.4C3 7 6.4 3 12 3z" />
          <path d="M7.6 9.4c1.6-2.4 3.6-3.4 6-3" opacity="0.7" />
          <path d="M6.4 14.8c.8 2.4 2.6 3.8 5 4.2" opacity="0.4" />
        </g>
      );
    case "suede":
      return (
        <g {...p}>
          <rect x="3.4" y="5.4" width="17.2" height="13.2" rx="3.4" />
          <path d="M6.4 9.6c2.8 1.2 5.8 1.2 8.6 0M6.4 13c3.4 1.4 7 1.4 10.4 0M8.6 16.2c2.6 1 5.2 1 7.8 0" opacity="0.55" />
        </g>
      );
    case "timber":
      return (
        <g {...p}>
          <circle cx="12" cy="12" r="9.2" />
          <circle cx="11.2" cy="12.4" r="6.2" opacity="0.7" />
          <circle cx="10.6" cy="12.8" r="3.4" opacity="0.5" />
          <circle cx="10.2" cy="13" r="1.1" opacity="0.8" />
        </g>
      );
    case "espresso":
      return (
        <g {...p}>
          <path d="M5 8h11v6.6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" />
          <path d="M16 9.6h2.2a2.4 2.4 0 0 1 0 4.8H16" />
          <path d="M4 21.4h14" opacity="0.6" />
          <path d="M8.6 3.4c-.8 1.2-.8 2 0 3.2M12.4 3.4c-.8 1.2-.8 2 0 3.2" opacity="0.5" />
        </g>
      );
    case "cacao":
      return (
        <g {...p}>
          <rect x="4" y="5" width="16" height="14" rx="1.2" />
          <path d="M4 10h16M4 14.4h16M9.4 5v14M14.6 5v14" opacity="0.5" />
          <path d="M20 5l-2.6 2.6" opacity="0.7" />
        </g>
      );
    case "sorbet":
      return (
        <g {...p}>
          <path d="M5.4 8h13.2l-5 5.6V21" />
          <path d="M8.6 21h6.8" opacity="0.6" />
          <circle cx="12" cy="6" r="3.2" opacity="0.8" />
        </g>
      );
    case "honey":
      return (
        <g {...p}>
          <path d="M4 4h16" />
          <path d="M12 4v7.4" />
          <path d="M12 11.4c1.8 2.6 2.8 4.2 2.8 5.6a2.8 2.8 0 0 1-5.6 0c0-1.4 1-3 2.8-5.6z" />
          <path d="M7.6 6.6c0 1.4-1.2 1.8-1.2 3M16.4 6.6c0 1.4 1.2 1.8 1.2 3" opacity="0.45" />
        </g>
      );
    case "dawn":
      return (
        <g {...p}>
          <path d="M2.4 17.4h19.2" />
          <path d="M6.6 17.4a5.4 5.4 0 0 1 10.8 0" />
          <path d="M12 5v3M4.6 9.6l2 2M19.4 9.6l-2 2" opacity="0.6" />
          <path d="M4 21h6M13.4 21h6.6" opacity="0.35" />
        </g>
      );
    case "dusk":
      return (
        <g {...p}>
          <path d="M2.4 15h19.2" />
          <path d="M7.6 15a4.4 4.4 0 0 1 8.8 0" />
          <path d="M3 19h18M6 22h12" opacity="0.4" />
          <path d="M12 6.4V8.6" opacity="0.6" />
        </g>
      );
    case "flacon":
      return (
        <g {...p}>
          <path d="M4.8 10.4a2 2 0 0 1 1.2-1.8l3-1.4V5.6h6v1.6l3 1.4a2 2 0 0 1 1.2 1.8V20a1.6 1.6 0 0 1-1.6 1.6H6.4A1.6 1.6 0 0 1 4.8 20z" />
          <path d="M9 5.6V3.4h6v2.2" />
          <path d="M8 2.4h8" opacity="0.7" />
          <path d="M7.6 13.4h8.8" opacity="0.45" />
        </g>
      );
    case "flute":
      return (
        <g {...p}>
          <path d="M9 21.6V11.2c0-1.6.6-2.6 1.4-3.4V6.2h3.2v1.6c.8.8 1.4 1.8 1.4 3.4v10.4a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1z" />
          <path d="M10.6 6.2V3.6h2.8v2.6" />
          <path d="M10 2.6h4" opacity="0.7" />
          <path d="M10.2 15.4h3.6" opacity="0.45" />
        </g>
      );
    case "flaconPair":
      return (
        <g {...p}>
          <path d="M2.6 12.6a1.6 1.6 0 0 1 1-1.5l2.2-1V8.6h4.4v1.5l2.2 1a1.6 1.6 0 0 1 1 1.5v7.7a1.2 1.2 0 0 1-1.2 1.2H3.8a1.2 1.2 0 0 1-1.2-1.2z" />
          <path d="M6 8.6V6.9h4.4v1.7" opacity="0.8" />
          <path d="M16.2 21.5v-8c0-1.2.5-2 1.1-2.6V9.5h2.4v1.4c.6.6 1.1 1.4 1.1 2.6v8z" />
          <path d="M17.3 9.5V7.4h2.4v2.1" opacity="0.8" />
        </g>
      );
    case "night":
      return (
        <g {...p}>
          <path d="M19.4 14.6A8.4 8.4 0 0 1 9.4 4.6a8.4 8.4 0 1 0 10 10z" />
          <path d="m17.6 3 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" opacity="0.75" />
        </g>
      );
  }
}
