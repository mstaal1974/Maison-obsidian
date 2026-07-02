// The Maison Obsidian flask mark, sized on demand.
export default function Logo({ width = 20, height = 24 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 20 24" fill="none" aria-hidden>
      <path
        d="M8 2h4M8.6 2v6.2L3.2 18.4A2 2 0 0 0 5 21.4h10a2 2 0 0 0 1.8-3L11.4 8.2V2"
        stroke="#c9a961"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M6.2 14.5h7.6" stroke="#c9a961" strokeWidth="1.2" />
    </svg>
  );
}
