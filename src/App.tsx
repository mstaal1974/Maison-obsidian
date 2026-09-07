import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import { type Fragrance, type FormatKey } from "./lib/data";
import { useFragrances, recordCommit, enrollVip, isVipSubscriber, fetchMyCommits, fetchMyShipments, type CommitRow, type ShipmentRow } from "./lib/store";
import { useAuth } from "./lib/auth";
import { useIsAdmin, type AdminCommitRow } from "./lib/admin";
import { demoShipments, subscribeShipments } from "./lib/catalogue";
import { authorizePayment } from "./lib/stripe";
import { parseHash, navigate, paths, type Route } from "./lib/route";
import { subscribeBag, bagLines, bagOrders, discoveryIds, addToBag, recordOrders, toggleDiscovery, clearDiscovery, type Order } from "./lib/bag";
import { sku as skuOf, FORMAT_BY_KEY, DISCOVERY_BOX_SIZE, DISCOVERY_BOX_PRICE } from "./lib/formats";
import AuthModal from "./components/AuthModal";
import MyReservations, { type Reservation } from "./components/MyReservations";
import AdminConsole from "./components/AdminConsole";
import ChatWidget from "./components/ChatWidget";
import Header from "./components/Header";
import Hero from "./components/Hero";
import ChooseObsidian from "./components/ChooseObsidian";
import FindYourScent from "./components/FindYourScent";
import MoodShop from "./components/MoodShop";
import RangeBanners from "./components/RangeBanners";
import Collection from "./components/Collection";
import Discovery from "./components/Discovery";
import About from "./components/About";
import ProductDetail from "./components/ProductDetail";
import QuickView from "./components/QuickView";
import BagDrawer from "./components/BagDrawer";
import Footer from "./components/Footer";

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [vip, setVip] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [quick, setQuick] = useState<{ frag: Fragrance; format?: FormatKey } | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [placed, setPlaced] = useState<Order[] | null>(null);

  const { fragrances, reload } = useFragrances();
  const auth = useAuth();
  const isAdmin = useIsAdmin(auth.user);
  const lines = useSyncExternalStore(subscribeBag, bagLines);
  const orders = useSyncExternalStore(subscribeBag, bagOrders);
  const boxIds = useSyncExternalStore(subscribeBag, discoveryIds);
  const bagCount = lines.reduce((n, l) => n + l.qty, 0);

  // ── Hash routing ───────────────────────────────────────────────────────────
  useEffect(() => {
    const sync = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // VIP membership from the backend for a signed-in user.
  useEffect(() => {
    if (!auth.user?.id) return;
    let active = true;
    void isVipSubscriber(auth.user.id).then((isVip) => {
      if (active && isVip) setVip(true);
    });
    return () => {
      active = false;
    };
  }, [auth.user]);

  /** Batch progress: server count plus what this visitor reserved locally. */
  const effective = useCallback((f: Fragrance) => f.committed + orders.filter((o) => o.fragranceId === f.id).reduce((n, o) => n + o.qty, 0), [orders]);

  // ── Bag actions ────────────────────────────────────────────────────────────
  const openQuick = useCallback((frag: Fragrance, format?: FormatKey) => setQuick({ frag, format }), []);

  const add = useCallback((frag: Fragrance, key: FormatKey, qty: number, engraving: string | null = null) => {
    if (frag.vipOnly && !vip) {
      navigate(paths.about);
      return;
    }
    addToBag(frag.id, key, qty, engraving);
    setQuick(null);
    setPlaced(null);
    setBagOpen(true);
  }, [vip]);

  const addBox = useCallback((frags: Fragrance[]) => {
    if (frags.length !== DISCOVERY_BOX_SIZE) return;
    const each = Math.round(DISCOVERY_BOX_PRICE / DISCOVERY_BOX_SIZE);
    frags.forEach((f) => addToBag(f.id, "perf10", 1, null, { unitPrice: each, label: "Discovery Box" }));
    clearDiscovery();
    setPlaced(null);
    setBagOpen(true);
  }, []);

  const onToggleDiscovery = useCallback((f: Fragrance) => {
    if (!toggleDiscovery(f.id, DISCOVERY_BOX_SIZE)) navigate(paths.discovery);
  }, []);

  // Reserve every line: authorise a hold, record the commit. Needs an account.
  const checkout = useCallback(async () => {
    setCheckingOut(true);
    try {
      const done: Omit<Order, "id" | "createdAt">[] = [];
      for (const l of lines) {
        const frag = fragrances.find((f) => f.id === l.fragranceId);
        if (!frag) continue;
        const s = skuOf(frag, l.format);
        const unit = l.unitPrice ?? s.price;
        const { paymentIntentId } = await authorizePayment(frag.id, unit * l.qty);
        await recordCommit(frag.id, l.engraving, s.def.sizeMl, unit, paymentIntentId, l.format, l.qty);
        done.push({ fragranceId: frag.id, format: l.format, sizeMl: s.def.sizeMl, qty: l.qty, chargeCents: unit, engraving: l.engraving });
      }
      setPlaced(recordOrders(done));
    } finally {
      setCheckingOut(false);
    }
  }, [lines, fragrances]);

  const requestCheckout = useCallback(() => {
    if (!auth.user) {
      setPendingCheckout(true);
      setAuthOpen(true);
      return;
    }
    void checkout();
  }, [auth.user, checkout]);

  // ── Account: reservations ──────────────────────────────────────────────────
  const [remoteCommits, setRemoteCommits] = useState<CommitRow[] | null>(null);
  const [remoteShipments, setRemoteShipments] = useState<ShipmentRow[] | null>(null);
  const demoShip = useSyncExternalStore(subscribeShipments, demoShipments);
  const usingRemote = auth.configured && !!auth.user?.id;
  const onAccount = route.view === "account";

  useEffect(() => {
    if (!onAccount || !usingRemote || !auth.user?.id) return;
    let active = true;
    void fetchMyCommits(auth.user.id).then((rows) => active && setRemoteCommits(rows));
    void fetchMyShipments(auth.user.id).then((rows) => active && setRemoteShipments(rows));
    return () => {
      active = false;
    };
  }, [onAccount, usingRemote, auth.user?.id, orders]);

  const shipmentFor = useCallback(
    (fragranceId: string): Partial<Reservation> => {
      if (usingRemote) {
        const s = (remoteShipments ?? []).find((x) => x.fragrance_id === fragranceId);
        return s ? { shipmentStatus: s.status, carrier: s.carrier ?? undefined, tracking: s.tracking_number ?? undefined, trackingUrl: s.tracking_url ?? undefined } : {};
      }
      const d = demoShip[fragranceId];
      return d ? { shipmentStatus: d.status, carrier: d.carrier, tracking: d.trackingNumber, trackingUrl: d.trackingUrl } : {};
    },
    [usingRemote, remoteShipments, demoShip],
  );

  const formatLabel = (key: string | null | undefined, sizeMl: number) =>
    key && key in FORMAT_BY_KEY ? FORMAT_BY_KEY[key as FormatKey].name : `${sizeMl} ml`;

  const reservations: Reservation[] = useMemo(() => {
    if (usingRemote) {
      return (remoteCommits ?? [])
        .map((row): Reservation | null => {
          const frag = fragrances.find((f) => f.id === row.fragrance_id);
          return frag
            ? { frag, sizeMl: row.size_ml, formatLabel: formatLabel(row.format, row.size_ml), chargeCents: row.charge_cents ?? undefined, engraving: row.engraving, status: row.status, effectiveCommitted: effective(frag), ...shipmentFor(frag.id) }
            : null;
        })
        .filter((r): r is Reservation => r !== null);
    }
    return orders
      .map((o): Reservation | null => {
        const frag = fragrances.find((f) => f.id === o.fragranceId);
        return frag
          ? { frag, sizeMl: o.sizeMl, formatLabel: formatLabel(o.format, o.sizeMl), qty: o.qty, chargeCents: o.chargeCents * o.qty, engraving: o.engraving, status: "authorized", effectiveCommitted: effective(frag), ...shipmentFor(frag.id) }
          : null;
      })
      .filter((r): r is Reservation => r !== null);
  }, [usingRemote, remoteCommits, orders, fragrances, effective, shipmentFor]);

  const demoAdminCommits: AdminCommitRow[] = useMemo(
    () => orders.map((o) => ({ id: o.id, fragrance_id: o.fragranceId, format: o.format, size_ml: o.sizeMl, charge_cents: o.chargeCents * o.qty, engraving: o.engraving, status: "authorized", created_at: "" })),
    [orders],
  );

  const joinVip = () => {
    if (!auth.user) {
      setAuthOpen(true);
      return;
    }
    setVip(true);
    void enrollVip(auth.user.email);
  };

  const selected = route.view === "product" ? fragrances.find((f) => f.slug === route.slug) ?? null : null;

  return (
    <div className="mo-grain" style={{ minHeight: "100vh", position: "relative", overflowX: "hidden" }}>
      <Header
        bagCount={bagCount}
        userEmail={auth.user?.email ?? null}
        isAdmin={isAdmin}
        onOpenBag={() => {
          setPlaced(null);
          setBagOpen(true);
        }}
        onSignIn={() => setAuthOpen(true)}
        onSignOut={() => {
          setVip(false);
          void auth.signOut();
        }}
      />

      {route.view === "home" && (
        <main data-screen-label="Home">
          <Hero />
          <ChooseObsidian />
          <FindYourScent fragrances={fragrances} onQuickView={openQuick} />
          <MoodShop fragrances={fragrances} onQuickView={openQuick} />
          <RangeBanners />
        </main>
      )}

      {(route.view === "shop" || route.view === "fragrances" || route.view === "car" || route.view === "body") && (
        <Collection
          key={`${route.view}:${route.view === "shop" ? route.facet ?? "" : ""}`}
          mode={route.view}
          facet={route.view === "shop" ? route.facet : null}
          fragrances={fragrances}
          vip={vip}
          discoveryIds={boxIds}
          onQuickView={openQuick}
          onToggleDiscovery={onToggleDiscovery}
        />
      )}

      {route.view === "discovery" && (
        <Discovery fragrances={fragrances} vip={vip} discoveryIds={boxIds} onToggleDiscovery={onToggleDiscovery} onAddBox={addBox} onQuickView={openQuick} />
      )}

      {route.view === "find" && <FindYourScent key={route.query} fragrances={fragrances} mode="page" initialQuery={route.query} onQuickView={openQuick} />}

      {route.view === "product" && selected && (
        <ProductDetail key={selected.slug} frag={selected} fragrances={fragrances} vip={vip} effectiveCommitted={effective(selected)} onAdd={add} onQuickView={openQuick} />
      )}
      {route.view === "product" && !selected && (
        <main style={{ maxWidth: 1340, margin: "0 auto", padding: "120px 32px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 48, color: "#f3ecdc" }}>Fragrance not found.</h1>
          <button className="mo-cta" onClick={() => navigate(paths.fragrances)} style={{ marginTop: 28, background: "#c9a961", color: "#0b0b0d", border: 0, cursor: "pointer", height: 48, padding: "0 26px", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 600 }}>
            Browse fragrances
          </button>
        </main>
      )}

      {route.view === "about" && <About vip={vip} signedIn={!!auth.user} onJoin={joinVip} />}

      {route.view === "account" && (
        <MyReservations reservations={reservations} loading={usingRemote && remoteCommits === null} onOpen={(slug) => navigate(paths.product(slug))} onBackToVault={() => navigate(paths.fragrances)} />
      )}

      {route.view === "admin" &&
        (isAdmin ? (
          <AdminConsole fragrances={fragrances} configured={auth.configured} onReload={reload} demoCommits={demoAdminCommits} />
        ) : (
          <main style={{ maxWidth: 1340, margin: "0 auto", padding: "120px 32px", textAlign: "center" }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 44, color: "#f3ecdc" }}>Admins only.</h1>
            <p style={{ marginTop: 12, fontSize: 13, color: "rgba(243,236,220,0.5)" }}>Sign in with an admin account to manage the atelier.</p>
          </main>
        ))}

      <Footer />

      {quick && <QuickView frag={quick.frag} initialFormat={quick.format} onClose={() => setQuick(null)} onAdd={(f, k, q) => add(f, k, q)} />}

      {bagOpen && (
        <BagDrawer
          lines={lines}
          fragrances={fragrances}
          placed={placed}
          busy={checkingOut}
          onClose={() => setBagOpen(false)}
          onCheckout={requestCheckout}
          onAddCar={(f) => addToBag(f.id, "car", 1)}
        />
      )}

      {authOpen && (
        <AuthModal
          configured={auth.configured}
          reason={pendingCheckout ? "reserve" : null}
          onClose={() => {
            setAuthOpen(false);
            setPendingCheckout(false);
          }}
          onAuthed={() => {
            if (pendingCheckout) {
              setPendingCheckout(false);
              void checkout();
            }
          }}
          signInEmail={auth.signInEmail}
          signUpEmail={auth.signUpEmail}
          signInGoogle={auth.signInGoogle}
        />
      )}

      <ChatWidget fragrances={fragrances} onOpenProduct={(slug) => navigate(paths.product(slug))} />
    </div>
  );
}
