import { type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Fragrance, GOLD, CREAM, money } from "../lib/data";
import { findMatches, fromPrice, isStrongMatch, profileOf, referenceOf, type Match } from "../lib/formats";
import { navigate, onRouteChange, paths } from "../lib/route";
import { trackSearch } from "../lib/analytics";
import { Arrow, Chip, Icon, InspiredBy } from "./ui";
import { MONO, SERIF, btnLink, micro } from "./styles";
import "../styles/search.css";

interface SearchOverlayProps {
  fragrances: Fragrance[];
  onClose: () => void;
  /** The control that opened the overlay; focus goes back to it on close. */
  returnFocus?: RefObject<HTMLElement | null>;
}

const MAX_SCENTS = 6;
const MAX_MATCHES = 3;
// Results follow the keyboard quickly; analytics waits for the shopper to
// settle so a typed word is one search, not one per letter.
const TYPE_DELAY = 150;
const TRACK_DELAY = 800;
const EXAMPLES = ["Oud", "Vanilla", "Leather", "Tom Ford", "Santal 33"];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Our own scents whose name, tagline, notes or profile contain the query.
 * Name hits lead; everything else keeps catalogue order.
 */
function searchCatalogue(query: string, frags: Fragrance[]): Fragrance[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const ranked: { f: Fragrance; rank: number }[] = [];
  frags.forEach((f) => {
    const name = f.name.toLowerCase();
    if (name.startsWith(q)) ranked.push({ f, rank: 0 });
    else if (name.includes(q)) ranked.push({ f, rank: 1 });
    else if ([f.tagline, ...profileOf(f)].some((s) => s.toLowerCase().includes(q))) ranked.push({ f, rank: 2 });
    else if ([...f.top, ...f.heart, ...f.base].some((s) => s.toLowerCase().includes(q))) ranked.push({ f, rank: 3 });
  });
  return ranked.sort((a, b) => a.rank - b.rank).slice(0, MAX_SCENTS).map((x) => x.f);
}

/**
 * The header search: one box for both ways people look for a scent — by our
 * own names and notes, or by a fragrance they already wear. A full-screen
 * sheet on phones, a top sheet on desktop.
 */
export default function SearchOverlay({ fragrances, onClose, returnFocus }: SearchOverlayProps) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tracked = useRef("");
  // Held in a ref so a parent re-render never re-runs the open/close effect
  // (which would bounce focus back to the button mid-search).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const scents = useMemo(() => searchCatalogue(term, fragrances), [term, fragrances]);
  const matches = useMemo<Match[]>(() => (term.trim() ? findMatches(term, fragrances, MAX_MATCHES) : []), [term, fragrances]);

  // Debounce the box into the term the results are built from.
  useEffect(() => {
    const t = window.setTimeout(() => setTerm(q), TYPE_DELAY);
    return () => window.clearTimeout(t);
  }, [q]);

  const track = useCallback((t: string, catalogue: number, match: number) => {
    const key = t.trim().toLowerCase();
    if (!key || key === tracked.current) return;
    tracked.current = key;
    trackSearch(t, "catalogue", catalogue);
    trackSearch(t, "match", match);
  }, []);

  // One search event per settled query.
  useEffect(() => {
    if (!term.trim()) return;
    const t = window.setTimeout(() => track(term, scents.length, matches.length), TRACK_DELAY);
    return () => window.clearTimeout(t);
  }, [term, scents, matches, track]);

  // Open: focus the box, lock the page behind, close on navigation. Close:
  // hand focus back to the search button.
  useEffect(() => {
    const target = returnFocus?.current;
    inputRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const off = onRouteChange(() => closeRef.current());
    return () => {
      document.body.style.overflow = previous;
      off();
      target?.focus();
    };
  }, [returnFocus]);

  // Escape closes; Tab cycles inside the dialog.
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Enter: straight to the first result, else the full matcher. Built from
  // the box itself so a fast typist doesn't land on a stale result.
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    const own = searchCatalogue(query, fragrances);
    const found = findMatches(query, fragrances, MAX_MATCHES);
    track(query, own.length, found.length);
    const strong = found.find(isStrongMatch);
    const to = own[0] ? paths.product(own[0].slug) : strong ? paths.product(strong.frag.slug) : paths.find(query);
    navigate(to);
    onClose();
  };

  const pick = (value: string) => {
    setQ(value);
    setTerm(value);
    inputRef.current?.focus();
  };

  // navigate() closes us via the route change; this covers a link to the
  // page we're already on.
  const follow = () => onClose();

  const searching = term.trim().length > 0;
  const empty = searching && !scents.length && !matches.length;

  const heading = { ...micro, color: GOLD, letterSpacing: "0.3em", margin: "0 0 12px" };
  const rowBase = {
    display: "grid",
    gap: 14,
    alignItems: "center",
    textDecoration: "none",
    color: CREAM,
    border: "1px solid #1f1f27",
    background: "#101015",
    padding: "12px 14px",
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mo-search-title"
      onKeyDown={onKeyDown}
      style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-start" }}
    >
      <div className="mo-search-scrim" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.66)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div className="mo-search-sheet" style={{ background: "#0d0d11" }}>
        <form className="mo-search-head" onSubmit={submit} role="search" style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid #1f1f27" }}>
          <h2 id="mo-search-title" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", margin: 0 }}>Search Maison Obsidian</h2>
          <div className="mo-search-field" style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, border: "1px solid rgba(201,169,97,0.45)", height: 50, padding: "0 14px" }}>
            <Icon name="search" size={17} color={CREAM} />
            <input
              ref={inputRef}
              className="mo-search-input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search scents, or a fragrance you love"
              aria-label="Search scents, or a fragrance you love"
              autoComplete="off"
              enterKeyHint="search"
              style={{ flex: 1, minWidth: 0, background: "none", border: 0, outline: "none", color: CREAM, fontFamily: MONO, fontSize: 13, letterSpacing: "0.02em" }}
            />
          </div>
          <button type="button" onClick={onClose} aria-label="Close search" style={{ background: "none", border: "1px solid #1f1f27", color: CREAM, width: 44, height: 44, flexShrink: 0, cursor: "pointer", fontSize: 20 }}>
            ×
          </button>
        </form>

        {/* Spoken once the results settle, not per keystroke. */}
        <div role="status" aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          {searching ? (empty ? `No results for ${term}` : `${scents.length} scents, ${matches.length} matches`) : ""}
        </div>

        <div className="mo-search-body mo-scroll" style={{ minHeight: 0, overflowY: "auto", padding: "22px 22px 28px", display: "grid", gap: 28 }}>
          {scents.length > 0 && (
            <section aria-labelledby="mo-search-own">
              <h3 id="mo-search-own" style={heading}>Maison Obsidian scents</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {scents.map((f) => (
                  <a key={f.id} href={paths.product(f.slug)} onClick={follow} className="mo-search-row" style={{ ...rowBase, gridTemplateColumns: "minmax(0,1fr) minmax(0,1.15fr)" }}>
                    <span style={{ display: "grid", gap: 5 }}>
                      <span style={{ fontFamily: SERIF, fontSize: 21, lineHeight: 1.05, letterSpacing: "0.04em", textTransform: "uppercase" }}>{f.name}</span>
                      <span style={{ ...micro, fontSize: 8.5, color: "rgba(243,236,220,0.6)" }}>{profileOf(f).join(" · ")}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: CREAM }}>From {money(fromPrice(f))}</span>
                    </span>
                    <InspiredBy {...referenceOf(f)} size="sm" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {matches.length > 0 && (
            <section aria-labelledby="mo-search-match">
              <h3 id="mo-search-match" style={heading}>Inspired by a fragrance you love</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {matches.map((m) => (
                  <a key={m.frag.id} href={paths.product(m.frag.slug)} onClick={follow} className="mo-search-row" style={{ ...rowBase, gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)" }}>
                    <InspiredBy {...referenceOf(m.frag)} size="sm" />
                    <span style={{ display: "grid", gap: 5 }}>
                      <span style={{ ...micro, fontSize: 8.5, color: isStrongMatch(m) ? GOLD : "rgba(243,236,220,0.55)" }}>
                        {isStrongMatch(m) ? "Your Obsidian" : m.matchedHouse ? "From the house" : `Closest profile · ${m.percent}%`}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontFamily: SERIF, fontSize: 21, lineHeight: 1.05, letterSpacing: "0.04em", textTransform: "uppercase" }}>{m.frag.name}</span>
                        <span style={{ color: GOLD, display: "flex" }}><Arrow size={11} /></span>
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: "rgba(243,236,220,0.7)" }}>From {money(fromPrice(m.frag))}</span>
                    </span>
                  </a>
                ))}
              </div>
              <a href={paths.find(term.trim())} onClick={follow} style={{ ...btnLink, textDecoration: "none", marginTop: 14 }}>
                See all matches <Arrow size={10} />
              </a>
            </section>
          )}

          {(!searching || empty) && (
            <section style={{ display: "grid", gap: 16 }}>
              {empty ? (
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "rgba(243,236,220,0.7)" }}>
                  Nothing in the house matches “{term.trim()}” yet.{" "}
                  <a href={paths.find(term.trim())} onClick={follow} style={{ color: GOLD }}>Request it</a>, or try another way in.
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "rgba(243,236,220,0.62)" }}>
                  Search our scents by name or note — or type a fragrance you already wear and we'll find the Obsidian built on it.
                </p>
              )}
              <div>
                <div style={heading}>Try</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {EXAMPLES.map((x) => (
                    <Chip key={x} onClick={() => pick(x)}>{x}</Chip>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap", paddingTop: 14, borderTop: "1px solid #1f1f27" }}>
                <a href={paths.shop()} onClick={follow} style={{ ...btnLink, textDecoration: "none" }}>Shop all <Arrow size={10} /></a>
                <a href={paths.discover} onClick={follow} style={{ ...btnLink, textDecoration: "none" }}>Discover your Scent DNA <Arrow size={10} /></a>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
