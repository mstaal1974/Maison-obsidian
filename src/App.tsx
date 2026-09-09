import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { type Fragrance, type FormatKey, money } from "./lib/data";
import { useFragrances, recordCommit, enrollVip, isVipSubscriber, fetchMyCommits, fetchMyShipments, type CommitRow, type ShipmentRow } from "./lib/store";
import { useAuth } from "./lib/auth";
import { useIsAdmin, type AdminCommitRow } from "./lib/admin";
import { demoShipments, subscribeShipments } from "./lib/catalogue";
import { authorizePayment, confirmStripeSession, stripeCheckout, stripeSubscribe } from "./lib/stripe";
import type { CheckoutDelivery } from "./lib/shipping";
import { parseHash, navigate, paths, type Route } from "./lib/route";
import { subscribeBag, bagLines, bagOrders, discoveryIds, addToBag, recordOrders, clearBag, toggleDiscovery, clearDiscovery, type Order } from "./lib/bag";
import { sku as skuOf, FORMAT_BY_KEY, DISCOVERY_BOX_SIZE, DISCOVERY_BOX_PRICE } from "./lib/formats";
import AuthModal from "./components/AuthModal";
import MyOrders, { type Order as AccountOrder } from "./components/MyOrders";
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
import Subscribe from "./components/Subscribe";
import SubscribeBand from "./components/SubscribeBand";
import SubscriptionPanel from "./components/SubscriptionPanel";
import { type PickMode, drawSurpriseScent, startSubscription, subscriptionPrice, useSubscriptions } from "./lib/subscription";
import PreferencesPanel from "./components/PreferencesPanel";
import { type Consents, affinityOf, setConsents, useConsents, useMyTaste } from "./lib/profile";
import { demoRequestQueries } from "./lib/requests";

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [vip, setVip] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [quick, setQuick] = useState<{ frag: Fragrance; format?: FormatKey } | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [placed, setPlaced] = useState<Order[] | null>(null);
  // The Monthly Pour: builder state and the sign-in hand-off, like checkout.
  const [pendingSub, setPendingSub] = useState<{ format: FormatKey; frag: Fragrance | null; mode: PickMode } | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [subStarted, setSubStarted] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const { fragrances, reload } = useFragrances();
  const auth = useAuth();
  const isAdmin = useIsAdmin(auth.user);
  const lines = useSyncExternalStore(subscribeBag, bagLines);
  const orders = useSyncExternalStore(subscribeBag, bagOrders);
  const boxIds = useSyncExternalStore(subscribeBag, discoveryIds);
  const bagCount = lines.reduce((n, l) => n + l.qty, 0);

  // ── Hash routing ───────────────────────────────────────────────────────────
  useEffect(() => {
    const sync = () => {
      setRoute(parseHash(window.location.hash));
      setSubStarted(false);
      setSubError(null);
    };
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

  // Reserve every line. With Stripe configured the bag goes to hosted
  // Checkout (a hold per reservation, recorded on return); otherwise the stub
  // authorises locally. Needs an account either way.
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const checkout = useCallback(async (delivery?: CheckoutDelivery) => {
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      // A real deployment always pays through Stripe. If that can't start we
      // stop and say so — recording an order nobody paid for would be worse
      // than failing. The local stub below is only for the offline demo.
      if (auth.configured) {
        const r = await stripeCheckout(
          lines.map((l) => ({ fragranceId: l.fragranceId, format: l.format, qty: l.qty, engraving: l.engraving, label: l.label })),
          delivery,
        );
        if (r?.ok) {
          window.location.assign(r.data.url);
          return;
        }
        const admin = isAdmin && r?.ok === false && r.detail ? ` (${r.detail})` : "";
        setCheckoutError(
          r?.ok === false && !r.unconfigured
            ? `${r.error}${admin}`
            : `Checkout is temporarily unavailable, so nothing has been charged or ordered. Please try again shortly.${admin}`,
        );
        return;
      }
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
  }, [lines, fragrances, auth.configured, isAdmin]);

  // ── Monthly Pour ───────────────────────────────────────────────────────────
  const { subscriptions, loading: subsLoading, reload: reloadSubs } = useSubscriptions(!!auth.user);
  const hasActiveSub = subscriptions.some((s) => s.status === "active");

  // ── Consent & taste ────────────────────────────────────────────────────────
  // Both consents default off. The taste profile is built from the customer's
  // own history and used only where they allowed it: the concierge prompt
  // and the surprise draw.
  const { consents, reload: reloadConsents } = useConsents(auth.user);
  const signupConsents = useRef<{ marketing: boolean; ai: boolean } | null>(null);
  const localPurchases = useMemo(() => orders.flatMap((o) => Array.from({ length: o.qty }, () => ({ fragranceId: o.fragranceId, format: o.format }))), [orders]);
  const onAccountView = route.view === "account";
  // Demo requests live in localStorage; re-read them whenever the account view opens.
  const localRequests = useMemo(() => (auth.configured || !onAccountView ? [] : demoRequestQueries()), [auth.configured, onAccountView]);
  const taste = useMyTaste(auth.user, fragrances, subscriptions, localPurchases, localRequests);
  const aiProfile = consents.ai && taste && !taste.empty ? taste.summary : undefined;
  const surpriseAffinity = consents.ai && taste ? affinityOf(taste) : undefined;
  const saveConsents = useCallback(
    async (c: Consents, source = "account") => {
      await setConsents(c, source, auth.user?.email ?? null);
      reloadConsents();
    },
    [auth.user, reloadConsents],
  );

  const startSub = useCallback(
    async (format: FormatKey, pick: Fragrance | null, mode: PickMode, email?: string) => {
      setSubBusy(true);
      setSubError(null);
      try {
        // As with checkout: never start a subscription we can't bill.
        if (auth.configured) {
          const r = await stripeSubscribe(format, pick?.id ?? null, mode);
          if (r?.ok) {
            window.location.assign(r.data.url);
            return;
          }
          const admin = isAdmin && r?.ok === false && r.detail ? ` (${r.detail})` : "";
          setSubError(
            r?.ok === false && !r.unconfigured
              ? `${r.error}${admin}`
              : `Subscriptions are temporarily unavailable, so nothing has been charged. Please try again shortly.${admin}`,
          );
          return;
        }
        // Surprise mode: the house draws month 1 now so the charge is a real bottle's.
        const frag = pick ?? drawSurpriseScent(fragrances, format, [], surpriseAffinity);
        if (!frag) {
          setSubError("Choose a scent to start.");
          return;
        }
        const charge = subscriptionPrice(frag, format);
        const { paymentIntentId } = await authorizePayment(frag.id, charge);
        const res = await startSubscription(format, frag.id, charge, paymentIntentId, email || auth.user?.email || null, mode);
        if (!res.ok) {
          setSubError(res.error ?? "Could not start the subscription.");
          return;
        }
        setSubStarted(true);
        reloadSubs();
      } finally {
        setSubBusy(false);
      }
    },
    [auth.user, auth.configured, fragrances, reloadSubs, surpriseAffinity, isAdmin],
  );

  const requestSubscribe = useCallback(
    (format: FormatKey, frag: Fragrance | null, mode: PickMode) => {
      if (!auth.user) {
        setPendingSub({ format, frag, mode });
        setAuthOpen(true);
        return;
      }
      void startSub(format, frag, mode);
    },
    [auth.user, startSub],
  );

  // The postage the customer picked, carried across a sign-in if one is needed.
  const pendingShipping = useRef<CheckoutDelivery | undefined>(undefined);
  const requestCheckout = useCallback(
    (delivery?: CheckoutDelivery) => {
      pendingShipping.current = delivery;
      if (!auth.user) {
        setPendingCheckout(true);
        setAuthOpen(true);
        return;
      }
      void checkout(delivery);
    },
    [auth.user, checkout],
  );

  // ── Account: reservations ──────────────────────────────────────────────────
  const [remoteCommits, setRemoteCommits] = useState<CommitRow[] | null>(null);
  const [remoteShipments, setRemoteShipments] = useState<ShipmentRow[] | null>(null);
  const demoShip = useSyncExternalStore(subscribeShipments, demoShipments);
  const usingRemote = auth.configured && !!auth.user?.id;
  const onAccount = route.view === "account";

  const [commitsVersion, setCommitsVersion] = useState(0);
  useEffect(() => {
    if (!onAccount || !usingRemote || !auth.user?.id) return;
    let active = true;
    void fetchMyCommits(auth.user.id).then((rows) => active && setRemoteCommits(rows));
    void fetchMyShipments(auth.user.id).then((rows) => active && setRemoteShipments(rows));
    return () => {
      active = false;
    };
  }, [onAccount, usingRemote, auth.user?.id, orders, commitsVersion]);

  // Back from Stripe Checkout: confirm the session (records it if the webhook
  // hasn't yet), clear the bag, and say what happened.
  const [stripeNotice, setStripeNotice] = useState<{ kind: "order" | "subscription"; detail: string } | null>(null);
  const sessionId = route.view === "account" ? route.sessionId : null;
  const sessionUserId = auth.user?.id ?? null;
  useEffect(() => {
    if (!sessionId || !sessionUserId) return;
    let active = true;
    void confirmStripeSession(sessionId).then((r) => {
      if (!active) return;
      if (r?.ok && r.data.kind === "order") {
        clearBag();
        setStripeNotice({ kind: "order", detail: `${(r.data.lines ?? []).reduce((n, l) => n + l.q, 0)} item(s) · ${money(r.data.amountTotal ?? 0)} paid` });
        setCommitsVersion((v) => v + 1);
      } else if (r?.ok && r.data.kind === "subscription") {
        setStripeNotice({ kind: "subscription", detail: "Your Monthly Pour is live. Month 1 is paid; the rest bill monthly." });
        reloadSubs();
      } else if (r?.ok === false) {
        setStripeNotice({ kind: "order", detail: r.error });
      }
      // Drop the session id from the URL so a refresh doesn't re-confirm.
      window.history.replaceState(null, "", "#/account");
    });
    return () => {
      active = false;
    };
  }, [sessionId, sessionUserId, reloadSubs]);

  const shipmentFor = useCallback(
    (fragranceId: string): Partial<AccountOrder> => {
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

  const accountOrders: AccountOrder[] = useMemo(() => {
    if (usingRemote) {
      return (remoteCommits ?? [])
        .map((row): AccountOrder | null => {
          const frag = fragrances.find((f) => f.id === row.fragrance_id);
          return frag
            ? { frag, sizeMl: row.size_ml, formatLabel: formatLabel(row.format, row.size_ml), chargeCents: row.charge_cents ?? undefined, engraving: row.engraving, status: row.status, placedAt: row.created_at, ...shipmentFor(frag.id) }
            : null;
        })
        .filter((r): r is AccountOrder => r !== null);
    }
    return orders
      .map((o): AccountOrder | null => {
        const frag = fragrances.find((f) => f.id === o.fragranceId);
        return frag
          ? { frag, sizeMl: o.sizeMl, formatLabel: formatLabel(o.format, o.sizeMl), qty: o.qty, chargeCents: o.chargeCents * o.qty, engraving: o.engraving, status: "captured", placedAt: new Date(o.createdAt).toISOString(), ...shipmentFor(frag.id) }
          : null;
      })
      .filter((r): r is AccountOrder => r !== null);
  }, [usingRemote, remoteCommits, orders, fragrances, shipmentFor]);

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
          <FindYourScent fragrances={fragrances} onQuickView={openQuick} userEmail={auth.user?.email} />
          <MoodShop fragrances={fragrances} onQuickView={openQuick} />
          <SubscribeBand />
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

      {route.view === "subscribe" && (
        <Subscribe
          fragrances={fragrances}
          vip={vip}
          initialSlug={route.slug}
          initialFormat={route.format}
          hasActive={hasActiveSub}
          busy={subBusy}
          started={subStarted}
          error={subError}
          onStart={requestSubscribe}
        />
      )}

      {route.view === "find" && <FindYourScent key={route.query} fragrances={fragrances} mode="page" initialQuery={route.query} onQuickView={openQuick} userEmail={auth.user?.email} />}

      {route.view === "product" && selected && (
        <ProductDetail key={selected.slug} frag={selected} fragrances={fragrances} vip={vip} onAdd={add} onQuickView={openQuick} />
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
        <MyOrders
          orders={accountOrders}
          loading={usingRemote && remoteCommits === null}
          onOpen={(slug) => navigate(paths.product(slug))}
          onBackToVault={() => navigate(paths.fragrances)}
          subscriptionSlot={<SubscriptionPanel subscriptions={subscriptions} fragrances={fragrances} loading={subsLoading} onChanged={reloadSubs} />}
          preferencesSlot={<PreferencesPanel consents={consents} taste={taste} onChange={(c) => saveConsents(c)} />}
          notice={
            stripeNotice ? (
              <div style={{ marginTop: 24, border: "1px solid rgba(201,169,97,0.6)", background: "#101015", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: "#f3ecdc" }}>{stripeNotice.kind === "subscription" ? "You're in." : "Thank you — your order is confirmed."}</span>
                <span style={{ fontSize: 13, color: "rgba(243,236,220,0.7)" }}>{stripeNotice.detail}</span>
              </div>
            ) : null
          }
        />
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
          error={checkoutError}
          onClose={() => setBagOpen(false)}
          onCheckout={requestCheckout}
          onAddCar={(f) => addToBag(f.id, "car", 1)}
        />
      )}

      {authOpen && (
        <AuthModal
          configured={auth.configured}
          reason={pendingCheckout ? "checkout" : pendingSub ? "subscribe" : null}
          onClose={() => {
            setAuthOpen(false);
            setPendingCheckout(false);
            setPendingSub(null);
          }}
          onConsents={(c) => {
            signupConsents.current = c;
          }}
          onAuthed={(email) => {
            if (signupConsents.current) {
              const c = signupConsents.current;
              signupConsents.current = null;
              void setConsents({ marketing: c.marketing, ai: c.ai }, "signup", email || null).then(() => reloadConsents());
            }
            if (pendingCheckout) {
              setPendingCheckout(false);
              void checkout(pendingShipping.current);
            }
            if (pendingSub) {
              // Runs before the auth state re-renders, so carry the email along.
              const { format, frag, mode } = pendingSub;
              setPendingSub(null);
              void startSub(format, frag, mode, email);
            }
          }}
          signInEmail={auth.signInEmail}
          signUpEmail={auth.signUpEmail}
          signInGoogle={auth.signInGoogle}
        />
      )}

      <ChatWidget fragrances={fragrances} onOpenProduct={(slug) => navigate(paths.product(slug))} profile={aiProfile} />
    </div>
  );
}
