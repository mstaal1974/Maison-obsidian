import { useSyncExternalStore } from "react";
import { money } from "../lib/data";
import { bagLines, discoveryProgress, subscribeBag } from "../lib/bag";
import { DISCOVERY_BOX_PRICE, DISCOVERY_BOX_SIZE } from "../lib/formats";
import { paths } from "../lib/route";

/**
 * Shown wherever a 10 ml is chosen (product page, quick view): any five 10 ml
 * samples become a Discovery Box in the bag, automatically, and how far the
 * shopper's bag is from the next one.
 */
export default function DiscoveryHint() {
  const lines = useSyncExternalStore(subscribeBag, bagLines, bagLines);
  const { boxes, loose, toNext } = discoveryProgress(lines);
  const progress = loose
    ? `You have ${loose} in your bag — add ${toNext} more.`
    : boxes
      ? `Your bag has ${boxes === 1 ? "a Discovery Box" : `${boxes} Discovery Boxes`}; ${DISCOVERY_BOX_SIZE} more 10 ml makes another.`
      : `Mix any ${DISCOVERY_BOX_SIZE} scents.`;
  return (
    <p className="mo-discovery-hint" style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.55, color: "rgba(243,236,220,0.82)", borderLeft: "2px solid #c9a961", padding: "2px 0 2px 12px" }}>
      Any {DISCOVERY_BOX_SIZE} × 10 ml make a Discovery Box: <b style={{ color: "#f3ecdc" }}>{money(DISCOVERY_BOX_PRICE)} for {DISCOVERY_BOX_SIZE}</b>, applied in your bag automatically. {progress}{" "}
      <a href={paths.discovery} style={{ color: "#d5b877", textUnderlineOffset: 3 }}>Build a box</a>
    </p>
  );
}
