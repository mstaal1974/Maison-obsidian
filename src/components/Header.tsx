import { type CSSProperties, useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { Icon } from "./ui";
import { MONO, SERIF } from "./styles";
import { navigate, paths } from "../lib/route";
import { GOLD, CREAM } from "../lib/data";

interface HeaderProps {
  bagCount: number;
  userEmail: string | null;
  isAdmin: boolean;
  onOpenBag: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

const navLink: CSSProperties = {
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

// SHOP mega-menu: fragrance first, format second — the architecture the brief
// asks for. Gender stays as a filter rather than the primary axis.
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
const BY_FORMAT: { label: string; to: string }[] = [
  { label: "Eau de Parfum", to: paths.fragrances },
  { label: "10ml Discovery", to: paths.discovery },
  { label: "30ml — Everyday Pour", to: paths.shop("30ml") },
  { label: "50ml — Signature Pour", to: paths.shop("50ml") },
  { label: "Car Diffusers", to: paths.car },
  { label: "Body", to: paths.body },
  { label: "Gift & Fragrance Sets", to: paths.shop("sets") },
];

export default function Header({ bagCount, userEmail, isAdmin, onOpenBag, onSignIn, onSignOut }: HeaderProps) {
  const [shopOpen, setShopOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const close = () => {
      setShopOpen(false);
      setMenuOpen(false);
    };
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, []);

  const openShop = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setShopOpen(true);
  };
  const closeShopSoon = () => {
    closeTimer.current = window.setTimeout(() => setShopOpen(false), 160);
  };

  return (
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
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <button onClick={() => navigate(paths.home)} style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: 0, cursor: "pointer", padding: 0 }} aria-label="Maison Obsidian home">
          <Logo width={22} height={26} />
          <span style={{ textAlign: "left" }}>
            <span style={{ display: "block", fontFamily: SERIF, fontSize: 18, letterSpacing: "0.16em", fontWeight: 600, lineHeight: 1, color: CREAM }}>MAISON OBSIDIAN</span>
            <span style={{ display: "block", fontFamily: MONO, fontSize: 8, letterSpacing: "0.32em", color: GOLD, marginTop: 5, textTransform: "uppercase" }}>Scents for a bolder you</span>
          </span>
        </button>

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
                  gridTemplateColumns: "180px 220px",
                  gap: 40,
                  boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
                }}
              >
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, marginBottom: 14 }}>Shop by fragrance</div>
                  {BY_FRAGRANCE.map((x) => (
                    <button key={x.facet} role="menuitem" className="mo-navlink" onClick={() => navigate(paths.shop(x.facet))} style={{ ...navLink, display: "block", padding: "7px 0", fontFamily: SERIF, fontSize: 17, letterSpacing: 0, textTransform: "none", color: CREAM }}>
                      {x.label}
                    </button>
                  ))}
                </div>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, marginBottom: 14 }}>Shop by format</div>
                  {BY_FORMAT.map((x) => (
                    <button key={x.label} role="menuitem" className="mo-navlink" onClick={() => navigate(x.to)} style={{ ...navLink, display: "block", padding: "7px 0", fontFamily: SERIF, fontSize: 17, letterSpacing: 0, textTransform: "none", color: CREAM }}>
                      {x.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="mo-navlink" style={navLink} onClick={() => navigate(paths.fragrances)}>Fragrances</button>
          <button className="mo-navlink" style={navLink} onClick={() => navigate(paths.discovery)}>Discovery</button>
          <button className="mo-navlink" style={navLink} onClick={() => navigate(paths.car)}>Car</button>
          <button className="mo-navlink" style={navLink} onClick={() => navigate(paths.body)}>Body &amp; Sets</button>
          <button className="mo-navlink" style={navLink} onClick={() => navigate(paths.subscribe())}>Subscribe</button>
          <button className="mo-navlink" style={{ ...navLink, color: GOLD }} onClick={() => navigate(paths.find())}>Find your scent</button>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button aria-label="Find your scent" onClick={() => navigate(paths.find())} style={{ background: "none", border: 0, cursor: "pointer", padding: 6, display: "grid", placeItems: "center" }}>
            <Icon name="search" size={19} color={CREAM} />
          </button>
          <span aria-hidden style={{ width: 1, height: 22, background: "#2a2a33" }} />
          <button
            className="mo-pill"
            onClick={onOpenBag}
            aria-label={`Your bag, ${bagCount} items`}
            style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(201,169,97,0.7)", height: 40, padding: "0 16px", background: "none", color: GOLD, cursor: "pointer", fontFamily: MONO, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}
          >
            <Icon name="bag" size={15} />
            Your bag ({bagCount})
          </button>
          <div style={{ position: "relative" }}>
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
                  ...(isAdmin ? [{ label: "Admin Console", to: paths.admin }] : []),
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
        </div>
      </div>
    </header>
  );
}
