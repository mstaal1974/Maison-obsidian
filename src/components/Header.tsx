import { type CSSProperties, useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import SearchOverlay from "./SearchOverlay";
import { useDialog } from "./useDialog";
import { Icon } from "./ui";
import { MONO, SERIF } from "./styles";
import { navigate, onRouteChange, paths } from "../lib/route";
import { type Fragrance, GOLD, CREAM } from "../lib/data";

interface HeaderProps {
  /** For the search overlay. */
  fragrances: Fragrance[];
  bagCount: number;
  userEmail: string | null;
  isAdmin: boolean;
  onOpenBag: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

const navLink: CSSProperties = {
  display: "inline-block",
  textDecoration: "none",
  background: "none",
  border: 0,
  cursor: "pointer",
  color: "rgba(243,236,220,0.78)",
  fontFamily: MONO,
  fontSize: 10.5,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  padding: "26px 0",
  whiteSpace: "nowrap",
};

// Five primary choices, each a customer intention rather than a slice of the
// catalogue. Formats, new arrivals and the Monthly Pour live one level down,
// under Shop, so every page stays within two clicks.
const PRIMARY: { label: string; to: string }[] = [
  { label: "Find My Scent", to: paths.find() },
  { label: "Discovery Sets", to: paths.discovery },
  { label: "Gifts", to: paths.shop("gifts") },
  { label: "Our House", to: paths.about },
];

// SHOP mega-menu: the range and its formats in one column, fragrance families
// in the other. Gender stays a filter rather than the primary axis.
const SHOP_LINKS: { label: string; to: string }[] = [
  { label: "All fragrances", to: paths.fragrances },
  { label: "New arrivals", to: paths.newArrivals },
  { label: "10ml — Try it", to: paths.shop("10ml") },
  { label: "30ml — Everyday", to: paths.shop("30ml") },
  { label: "50ml — Signature", to: paths.shop("50ml") },
  { label: "Car diffusers", to: paths.car },
  { label: "Body & bath", to: paths.body },
  { label: "Sets", to: paths.shop("sets") },
  { label: "Subscribe & save", to: paths.subscribe() },
];
const BY_FRAGRANCE: { label: string; facet: string }[] = [
  { label: "For Him", facet: "him" },
  { label: "For Her", facet: "her" },
  { label: "Unisex", facet: "unisex" },
  { label: "Woody", facet: "woody" },
  { label: "Fresh", facet: "fresh" },
  { label: "Gourmand", facet: "gourmand" },
  { label: "Floral", facet: "floral" },
  { label: "Spicy", facet: "spicy" },
];

export default function Header({ fragrances, bagCount, userEmail, isAdmin, onOpenBag, onSignIn, onSignOut }: HeaderProps) {
  const [shopOpen, setShopOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Below 1000px the primary nav is hidden; this drawer is the only way through
  // the site on a phone.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const close = () => {
      setShopOpen(false);
      setMenuOpen(false);
      setDrawerOpen(false);
      setSearchOpen(false);
    };
    return onRouteChange(close);
  }, []);

  const openShop = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setShopOpen(true);
  };
  const closeShopSoon = () => {
    closeTimer.current = window.setTimeout(() => setShopOpen(false), 160);
  };

  return (
    <>
        <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 60,
          background: "rgba(11,11,13,0.9)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid #1f1f27",
        }}
      >
        <div className="mo-header-row" style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <a href={paths.home} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }} aria-label="Maison Obsidian home">
            <Logo width={22} height={26} />
            <span style={{ textAlign: "left" }}>
              <span className="mo-wordmark" style={{ display: "block", fontFamily: SERIF, fontSize: 18, letterSpacing: "0.16em", fontWeight: 600, lineHeight: 1, color: CREAM }}>MAISON OBSIDIAN</span>
              <span className="mo-wordmark-sub" style={{ display: "block", fontFamily: MONO, fontSize: 8, letterSpacing: "0.32em", color: GOLD, marginTop: 5, textTransform: "uppercase" }}>Scents for a bolder you</span>
            </span>
          </a>

          <nav className="mo-nav" style={{ display: "flex", alignItems: "center", gap: 26, position: "relative" }} aria-label="Primary">
            <div onMouseEnter={openShop} onMouseLeave={closeShopSoon} style={{ position: "relative" }}>
              <button className="mo-navlink" style={{ ...navLink, color: shopOpen ? GOLD : navLink.color }} onClick={() => setShopOpen((o) => !o)} aria-expanded={shopOpen} aria-haspopup="true">
                Shop
              </button>
              {shopOpen && (
                <div
                  role="menu"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: -24,
                    background: "#0f0f13",
                    border: "1px solid #1f1f27",
                    padding: "26px 30px 28px",
                    display: "grid",
                    gridTemplateColumns: "210px 170px",
                    gap: 40,
                    boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
                  }}
                >
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, marginBottom: 14 }}>Shop</div>
                    {SHOP_LINKS.map((x) => (
                      <a key={x.label} role="menuitem" className="mo-navlink" href={x.to} style={{ ...navLink, display: "block", padding: "7px 0", fontFamily: SERIF, fontSize: 17, letterSpacing: 0, textTransform: "none", color: CREAM }}>
                        {x.label}
                      </a>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, marginBottom: 14 }}>By fragrance</div>
                    {BY_FRAGRANCE.map((x) => (
                      <a key={x.facet} role="menuitem" className="mo-navlink" href={paths.shop(x.facet)} style={{ ...navLink, display: "block", padding: "7px 0", fontFamily: SERIF, fontSize: 17, letterSpacing: 0, textTransform: "none", color: CREAM }}>
                        {x.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {PRIMARY.map((x) => (
              <a key={x.label} className="mo-navlink" style={navLink} href={x.to}>{x.label}</a>
            ))}
          </nav>

          <div className="mo-header-actions" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button aria-label="Search" aria-haspopup="dialog" onClick={() => setSearchOpen(true)} style={{ background: "none", border: 0, cursor: "pointer", padding: 6, display: "grid", placeItems: "center" }}>
              <Icon name="search" size={19} color={CREAM} />
            </button>
            <span className="mo-header-divider" aria-hidden style={{ width: 1, height: 22, background: "#2a2a33" }} />
            <button
              className="mo-pill mo-bag-btn"
              onClick={onOpenBag}
              aria-label={`Your bag, ${bagCount} items`}
              style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(201,169,97,0.7)", height: 40, padding: "0 16px", background: "none", color: GOLD, cursor: "pointer", fontFamily: MONO, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}
            >
              <Icon name="bag" size={15} />
              <span className="mo-bag-label">Your bag </span>({bagCount})
            </button>
            <div className="mo-account-desktop" style={{ position: "relative" }}>
              <button
                className="mo-navlink"
                onClick={() => (userEmail ? setMenuOpen((o) => !o) : onSignIn())}
                style={{ ...navLink, padding: "10px 0", color: userEmail ? CREAM : "rgba(243,236,220,0.78)" }}
                aria-haspopup={userEmail ? "true" : undefined}
                aria-expanded={userEmail ? menuOpen : undefined}
              >
                {userEmail ? "Account" : "Sign In"}
              </button>
              {menuOpen && userEmail && (
                <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", minWidth: 220, background: "#0f0f13", border: "1px solid #1f1f27", padding: 8, boxShadow: "0 24px 50px rgba(0,0,0,0.55)" }}>
                  <div style={{ padding: "8px 12px", fontFamily: MONO, fontSize: 10, color: "rgba(243,236,220,0.55)", borderBottom: "1px solid #1f1f27", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
                  {[
                    { label: "My Orders", to: paths.account },
                    { label: "My Monthly Pour", to: paths.account },
                    ...(isAdmin ? [{ label: "Admin Console", to: paths.admin }, { label: "Staff Order Desk", to: paths.staff }] : []),
                  ].map((x) => (
                    <button key={x.label} role="menuitem" className="mo-softhover" onClick={() => navigate(x.to)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer", color: CREAM, padding: "10px 12px", fontSize: 13 }}>
                      {x.label}
                    </button>
                  ))}
                  <button role="menuitem" className="mo-softhover" onClick={onSignOut} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer", color: "rgba(243,236,220,0.6)", padding: "10px 12px", fontSize: 13 }}>
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            <button
              className="mo-burger"
              onClick={() => setDrawerOpen((o) => !o)}
              aria-label={drawerOpen ? "Close menu" : "Open menu"}
              aria-expanded={drawerOpen}
              aria-controls="mo-mobile-menu"
              style={{ background: "none", border: 0, cursor: "pointer", padding: 6, placeItems: "center", color: CREAM }}
            >
              {drawerOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
                  <path d="M5 5l14 14M19 5 5 19" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
                  <path d="M3 6h18M3 12h18M3 18h18" />
                </svg>
              )}
            </button>
          </div>
        </div>

      </header>

      {/* Outside <header> on purpose: its backdrop-filter makes it the
          containing block for position:fixed, which would trap the drawer
          inside a 72px-tall box. */}
      {drawerOpen && <MobileMenu userEmail={userEmail} isAdmin={isAdmin} onSignIn={onSignIn} onSignOut={onSignOut} onClose={() => setDrawerOpen(false)} />}
      {searchOpen && <SearchOverlay fragrances={fragrances} onClose={() => setSearchOpen(false)} />}
    </>
  );
}

/**
 * The phone menu: the same five choices as the desktop bar, in the same order,
 * with Shop opening in place to the same two columns, then the account.
 */
function MobileMenu({
  userEmail,
  isAdmin,
  onSignIn,
  onSignOut,
  onClose,
}: {
  userEmail: string | null;
  isAdmin: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, true, onClose);
  // navigate() fires a route change, which closes the drawer; go() covers the
  // case where the link is to the page we are already on.
  const go = (to: string) => {
    navigate(to);
    onClose();
  };
  const heading: CSSProperties = { fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, margin: "14px 0 4px" };
  const item: CSSProperties = {
    display: "block",
    textDecoration: "none",
    width: "100%",
    textAlign: "left",
    background: "none",
    border: 0,
    borderBottom: "1px solid #17171d",
    cursor: "pointer",
    color: CREAM,
    fontFamily: SERIF,
    fontSize: 21,
    padding: "14px 0",
  };
  const sub: CSSProperties = { ...item, fontSize: 16, padding: "10px 0" };

  return (
    <div
      ref={ref}
      id="mo-mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="mo-drawer-sheet"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: 72,
        bottom: 0,
        zIndex: 97,
        background: "rgba(11,11,13,0.98)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderTop: "1px solid #1f1f27",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <nav style={{ padding: "12px 24px 40px", display: "grid", gap: 22 }} aria-label="Mobile">
        <div>
          <details className="mo-menu-details">
            <summary style={{ ...item, listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Shop <span aria-hidden className="mo-menu-caret" style={{ color: GOLD, fontSize: 16 }}>+</span>
            </summary>
            <div style={{ padding: "0 0 8px 14px" }}>
              <div style={heading}>Shop</div>
              {SHOP_LINKS.map((x) => (
                <a key={x.label} href={x.to} onClick={onClose} style={sub}>{x.label}</a>
              ))}
              <div style={heading}>By fragrance</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
                {BY_FRAGRANCE.map((x) => (
                  <a key={x.facet} href={paths.shop(x.facet)} onClick={onClose} style={sub}>{x.label}</a>
                ))}
              </div>
            </div>
          </details>
          {PRIMARY.map((x) => (
            <a key={x.label} href={x.to} onClick={onClose} style={item}>{x.label}</a>
          ))}
        </div>

        <div>
          <div style={{ ...heading, marginTop: 0 }}>Account</div>
          {userEmail ? (
            <>
              <div style={{ fontFamily: MONO, fontSize: 10, color: "rgba(243,236,220,0.5)", paddingBottom: 10, overflow: "hidden", textOverflow: "ellipsis" }}>{userEmail}</div>
              <button onClick={() => go(paths.account)} style={sub}>My Orders</button>
              <button onClick={() => go(paths.account)} style={sub}>My Monthly Pour</button>
              {isAdmin && (
                <>
                  <button onClick={() => go(paths.admin)} style={sub}>Admin Console</button>
                  <button onClick={() => go(paths.staff)} style={sub}>Staff Order Desk</button>
                </>
              )}
              <button
                onClick={() => {
                  onSignOut();
                  onClose();
                }}
                style={{ ...sub, color: "rgba(243,236,220,0.6)" }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                onSignIn();
                onClose();
              }}
              style={sub}
            >
              Sign In
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
