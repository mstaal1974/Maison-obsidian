import { useState, useEffect, useCallback } from "react";
import { type Fragrance, type Filter, pad } from "./lib/data";
import { useFragrances, recordCommit, enrollVip } from "./lib/store";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Vault from "./components/Vault";
import Method from "./components/Method";
import VIP from "./components/VIP";
import ProductDetail from "./components/ProductDetail";
import CommitDrawer from "./components/CommitDrawer";
import Footer from "./components/Footer";
import LayoutSwitch from "./components/LayoutSwitch";

type View = "home" | "product";
type Direction = "gallery" | "ledger";
interface CommitRecord {
  label: string | null;
  sizeMl?: number;
  chargeCents?: number;
}

const STORAGE_KEY = "mo:commits";

function loadCommits(): Record<string, CommitRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CommitRecord>) : {};
  } catch {
    return {};
  }
}

/** Read the product slug out of the URL hash (#/fragrance/:slug). */
function slugFromHash(): string | null {
  const m = window.location.hash.match(/^#\/fragrance\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function App() {
  const [view, setView] = useState<View>("home");
  const [slug, setSlug] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [direction, setDirection] = useState<Direction>("gallery");
  const [committed, setCommitted] = useState<Record<string, CommitRecord>>(loadCommits);
  const [lastCommittedId, setLastCommittedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vip, setVip] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const { fragrances } = useFragrances();
  const showInspiration = true;

  // ── Hash routing: keep view/slug in sync with the URL ──────────────────────
  useEffect(() => {
    const sync = () => {
      const s = slugFromHash();
      if (s) {
        setSlug(s);
        setView("product");
      } else {
        setView("home");
        setSlug(null);
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // ── Persist commits ────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(committed));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [committed]);

  const effective = useCallback(
    (f: Fragrance) => f.committed + (committed[f.id] ? 1 : 0),
    [committed],
  );

  const go = useCallback(
    (id: string) => {
      const scroll = () => {
        const el = document.getElementById(id);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
      };
      if (view !== "home") {
        window.location.hash = "";
        setTimeout(scroll, 60);
      } else {
        scroll();
      }
    },
    [view],
  );

  const openProduct = useCallback((s: string) => {
    window.location.hash = `#/fragrance/${s}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const backHome = useCallback(() => {
    window.location.hash = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const selected = view === "product" && slug ? fragrances.find((f) => f.slug === slug) ?? null : null;
  const lastCommit = lastCommittedId ? fragrances.find((f) => f.id === lastCommittedId) ?? null : null;

  const commitSelected = useCallback(
    (engraving: string | null, sizeMl: number, chargeCents: number) => {
      if (!selected) return;
      const locked = !!selected.vipOnly && !vip;
      if (locked || committed[selected.id]) return;
      setCommitted((prev) => ({ ...prev, [selected.id]: { label: engraving, sizeMl, chargeCents } }));
      setLastCommittedId(selected.id);
      setDrawerOpen(true);
      // Persist to the backend when configured (optimistic UI already updated).
      void recordCommit(selected.id, engraving, sizeMl, chargeCents);
    },
    [selected, vip, committed],
  );

  const commitCount = pad(Object.keys(committed).length);
  const hasCommits = Object.keys(committed).length > 0;

  return (
    <div className="mo-grain" style={{ minHeight: "100vh", position: "relative", overflowX: "hidden" }}>
      <Header
        commitCount={commitCount}
        accountLabel={signedIn ? "Account" : "Sign In"}
        onBackHome={backHome}
        onGoVault={() => go("mo-vault")}
        onGoMethod={() => go("mo-method")}
        onGoVip={() => go("mo-vip")}
        onOpenDrawer={() => setDrawerOpen(true)}
        onSignIn={() => setSignedIn((v) => !v)}
      />

      {view === "home" && (
        <main data-screen-label="Home">
          <Hero onGoVault={() => go("mo-vault")} onGoMethod={() => go("mo-method")} />
          <Vault
            fragrances={fragrances}
            filter={filter}
            direction={direction}
            vip={vip}
            showInspiration={showInspiration}
            effective={effective}
            onFilter={setFilter}
            onOpen={openProduct}
          />
          <Method />
          <VIP
            vip={vip}
            onJoin={(email) => {
              setVip(true);
              void enrollVip(email);
            }}
          />
        </main>
      )}

      {view === "product" && selected && (
        <ProductDetail
          key={selected.slug}
          frag={selected}
          effectiveCommitted={effective(selected)}
          vip={vip}
          showInspiration={showInspiration}
          committedHere={!!committed[selected.id]}
          onBack={backHome}
          onCommit={commitSelected}
        />
      )}

      {view === "product" && !selected && (
        <main style={{ maxWidth: 1340, margin: "0 auto", padding: "120px 32px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 48, color: "#f3ecdc" }}>
            Fragrance not found.
          </h1>
          <button
            className="mo-cta"
            onClick={backHome}
            style={{
              marginTop: 28,
              background: "#c9a961",
              color: "#0b0b0d",
              border: 0,
              cursor: "pointer",
              height: 48,
              padding: "0 26px",
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Enter the Vault
          </button>
        </main>
      )}

      <Footer />

      {drawerOpen && (
        <CommitDrawer
          lastCommit={lastCommit}
          effectiveCommitted={lastCommit ? effective(lastCommit) : 0}
          engraving={lastCommit && committed[lastCommit.id] ? committed[lastCommit.id].label : null}
          sizeMl={lastCommit && committed[lastCommit.id] ? committed[lastCommit.id].sizeMl : undefined}
          chargeCents={lastCommit && committed[lastCommit.id] ? committed[lastCommit.id].chargeCents : undefined}
          hasCommits={hasCommits}
          showInspiration={showInspiration}
          onClose={() => setDrawerOpen(false)}
          onToVault={() => {
            setDrawerOpen(false);
            backHome();
            setTimeout(() => go("mo-vault"), 60);
          }}
        />
      )}

      {view === "home" && (
        <LayoutSwitch
          direction={direction}
          onGallery={() => setDirection("gallery")}
          onLedger={() => setDirection("ledger")}
        />
      )}
    </div>
  );
}
