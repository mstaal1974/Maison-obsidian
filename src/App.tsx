import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import { type Fragrance, type Filter, pad } from "./lib/data";
import {
  useFragrances,
  recordCommit,
  enrollVip,
  isVipSubscriber,
  fetchMyCommits,
  fetchMyShipments,
  type CommitRow,
  type ShipmentRow,
} from "./lib/store";
import { useAuth } from "./lib/auth";
import { useIsAdmin, type AdminCommitRow } from "./lib/admin";
import { demoShipments, subscribeShipments } from "./lib/catalogue";
import { authorizePayment } from "./lib/stripe";
import AuthModal from "./components/AuthModal";
import MyReservations, { type Reservation } from "./components/MyReservations";
import AdminConsole from "./components/AdminConsole";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Vault from "./components/Vault";
import Method from "./components/Method";
import VIP from "./components/VIP";
import ProductDetail from "./components/ProductDetail";
import CommitDrawer from "./components/CommitDrawer";
import Footer from "./components/Footer";
import LayoutSwitch from "./components/LayoutSwitch";

type View = "home" | "product" | "account" | "admin";
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
  const [authOpen, setAuthOpen] = useState(false);

  const { fragrances, reload } = useFragrances();
  const auth = useAuth();
  const isAdmin = useIsAdmin(auth.user);
  const showInspiration = true;

  // Reflect VIP membership from the backend for a signed-in user (sign-out
  // resets vip in the handler below). Demo membership is tracked locally.
  useEffect(() => {
    if (!auth.user?.id) return; // signed out or demo user — nothing to fetch
    let active = true;
    void isVipSubscriber(auth.user.id).then((isVip) => {
      if (active && isVip) setVip(true);
    });
    return () => {
      active = false;
    };
  }, [auth.user]);

  // ── Hash routing: keep view/slug in sync with the URL ──────────────────────
  useEffect(() => {
    const sync = () => {
      const s = slugFromHash();
      if (s) {
        setSlug(s);
        setView("product");
      } else if (window.location.hash === "#/account") {
        setView("account");
        setSlug(null);
      } else if (window.location.hash === "#/admin") {
        setView("admin");
        setSlug(null);
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

  const goAccount = useCallback(() => {
    window.location.hash = "#/account";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const goAdmin = useCallback(() => {
    window.location.hash = "#/admin";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const selected = view === "product" && slug ? fragrances.find((f) => f.slug === slug) ?? null : null;
  const lastCommit = lastCommittedId ? fragrances.find((f) => f.id === lastCommittedId) ?? null : null;

  const commitSelected = useCallback(
    (engraving: string | null, sizeMl: number, chargeCents: number) => {
      if (!selected) return;
      const locked = !!selected.vipOnly && !vip;
      if (locked || committed[selected.id]) return;
      // Optimistic UI first, then authorize the hold + persist the commit.
      setCommitted((prev) => ({ ...prev, [selected.id]: { label: engraving, sizeMl, chargeCents } }));
      setLastCommittedId(selected.id);
      setDrawerOpen(true);
      void (async () => {
        const { paymentIntentId } = await authorizePayment(selected.id, chargeCents);
        await recordCommit(selected.id, engraving, sizeMl, chargeCents, paymentIntentId);
      })();
    },
    [selected, vip, committed],
  );

  // ── Account: the signed-in user's reservations ─────────────────────────────
  const [remoteCommits, setRemoteCommits] = useState<CommitRow[] | null>(null);
  const usingRemote = auth.configured && !!auth.user?.id;

  useEffect(() => {
    if (view !== "account" || !usingRemote || !auth.user?.id) return;
    let active = true;
    void fetchMyCommits(auth.user.id).then((rows) => {
      if (active) setRemoteCommits(rows);
    });
    return () => {
      active = false;
    };
  }, [view, usingRemote, auth.user?.id, committed]);

  // Shipments to surface on each reservation.
  const [remoteShipments, setRemoteShipments] = useState<ShipmentRow[] | null>(null);
  const demoShip = useSyncExternalStore(subscribeShipments, demoShipments);

  useEffect(() => {
    if (view !== "account" || !usingRemote || !auth.user?.id) return;
    let active = true;
    void fetchMyShipments(auth.user.id).then((rows) => {
      if (active) setRemoteShipments(rows);
    });
    return () => {
      active = false;
    };
  }, [view, usingRemote, auth.user?.id, committed]);

  const shipmentFor = useCallback(
    (fragranceId: string): Partial<Reservation> => {
      if (usingRemote) {
        const s = (remoteShipments ?? []).find((x) => x.fragrance_id === fragranceId);
        return s
          ? { shipmentStatus: s.status, carrier: s.carrier ?? undefined, tracking: s.tracking_number ?? undefined, trackingUrl: s.tracking_url ?? undefined }
          : {};
      }
      const d = demoShip[fragranceId];
      return d ? { shipmentStatus: d.status, carrier: d.carrier, tracking: d.trackingNumber, trackingUrl: d.trackingUrl } : {};
    },
    [usingRemote, remoteShipments, demoShip],
  );

  const reservations: Reservation[] = useMemo(() => {
    if (usingRemote) {
      return (remoteCommits ?? [])
        .map((row): Reservation | null => {
          const frag = fragrances.find((f) => f.id === row.fragrance_id);
          if (!frag) return null;
          return {
            frag,
            sizeMl: row.size_ml,
            chargeCents: row.charge_cents ?? undefined,
            engraving: row.engraving,
            status: row.status,
            effectiveCommitted: effective(frag),
            ...shipmentFor(frag.id),
          };
        })
        .filter((r): r is Reservation => r !== null);
    }
    // Demo / offline — build from the local commit map.
    return Object.entries(committed)
      .map(([id, rec]): Reservation | null => {
        const frag = fragrances.find((f) => f.id === id);
        if (!frag) return null;
        return {
          frag,
          sizeMl: rec.sizeMl,
          chargeCents: rec.chargeCents,
          engraving: rec.label,
          status: "authorized",
          effectiveCommitted: effective(frag),
          ...shipmentFor(frag.id),
        };
      })
      .filter((r): r is Reservation => r !== null);
  }, [usingRemote, remoteCommits, committed, fragrances, effective, shipmentFor]);

  // Commits passed to the admin fulfillment tab in demo mode.
  const demoAdminCommits: AdminCommitRow[] = useMemo(
    () =>
      Object.entries(committed).map(([id, rec]) => ({
        id,
        fragrance_id: id,
        size_ml: rec.sizeMl ?? 50,
        charge_cents: rec.chargeCents ?? null,
        engraving: rec.label,
        status: "authorized",
        created_at: "",
      })),
    [committed],
  );

  const reservationsLoading = usingRemote && view === "account" && remoteCommits === null;

  const commitCount = pad(Object.keys(committed).length);
  const hasCommits = Object.keys(committed).length > 0;

  return (
    <div className="mo-grain" style={{ minHeight: "100vh", position: "relative", overflowX: "hidden" }}>
      <Header
        commitCount={commitCount}
        userEmail={auth.user?.email ?? null}
        onBackHome={backHome}
        onGoVault={() => go("mo-vault")}
        onGoMethod={() => go("mo-method")}
        onGoVip={() => go("mo-vip")}
        onOpenDrawer={() => setDrawerOpen(true)}
        onSignIn={() => setAuthOpen(true)}
        onSignOut={() => {
          setVip(false);
          void auth.signOut();
        }}
        onGoAccount={goAccount}
        onGoAdmin={goAdmin}
        isAdmin={isAdmin}
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
            signedIn={!!auth.user}
            onJoin={() => {
              if (!auth.user) {
                setAuthOpen(true);
                return;
              }
              setVip(true);
              void enrollVip(auth.user.email);
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

      {view === "account" && (
        <MyReservations
          reservations={reservations}
          loading={reservationsLoading}
          onOpen={openProduct}
          onBackToVault={() => {
            backHome();
            setTimeout(() => go("mo-vault"), 60);
          }}
        />
      )}

      {view === "admin" &&
        (isAdmin ? (
          <AdminConsole fragrances={fragrances} configured={auth.configured} onReload={reload} demoCommits={demoAdminCommits} />
        ) : (
          <main style={{ maxWidth: 1340, margin: "0 auto", padding: "120px 32px", textAlign: "center" }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 44, color: "#f3ecdc" }}>
              Admins only.
            </h1>
            <p style={{ marginTop: 12, fontSize: 13, color: "rgba(243,236,220,0.5)" }}>
              Sign in with an admin account to manage the atelier.
            </p>
          </main>
        ))}

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

      {authOpen && (
        <AuthModal
          configured={auth.configured}
          onClose={() => setAuthOpen(false)}
          signInEmail={auth.signInEmail}
          signUpEmail={auth.signUpEmail}
          signInGoogle={auth.signInGoogle}
        />
      )}
    </div>
  );
}
