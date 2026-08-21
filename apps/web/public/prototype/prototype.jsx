/* prototype.jsx — main router + tweaks panel for Forumo */

const { useState: useStateP, useEffect: useEffectP } = React;

const { TopBar, HomeScreen, ListingsScreen, ListingDetailScreen } =
  window.FORUMO_SCREENS_1;
const { CartScreen, CheckoutScreen, OrderScreen } = window.FORUMO_SCREENS_2;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  palette: "terracotta",
  density: "regular",
  cardStyle: "card",
  trust: "medium",
}; /*EDITMODE-END*/

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useStateP({ screen: "home" });
  const [cart, setCart] = useStateP([]);
  const [toast, setToast] = useStateP({ show: false, msg: "" });

  useEffectP(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (!h) return;
      try {
        const r = JSON.parse(decodeURIComponent(h));
        setRoute(r);
      } catch {}
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const go = (r) => {
    setRoute(r);
    window.location.hash = encodeURIComponent(JSON.stringify(r));
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const onAddToCart = (listing, qty = 1) => {
    setCart((c) => {
      const existing = c.find((i) => i.listingId === listing.id);
      if (existing)
        return c.map((i) =>
          i.listingId === listing.id ? { ...i, quantity: i.quantity + qty } : i,
        );
      return [...c, { listingId: listing.id, quantity: qty }];
    });
    setToast({ show: true, msg: `Added to cart — ${listing.title}` });
    setTimeout(() => setToast({ show: false, msg: "" }), 2200);
  };

  const cartCount = cart.reduce((a, i) => a + i.quantity, 0);

  useEffectP(() => {
    if (
      cart.length === 0 &&
      route.screen === "cart" &&
      !window.__forumoSeeded
    ) {
      window.__forumoSeeded = true;
      setCart([
        { listingId: "l1", quantity: 1 },
        { listingId: "l3", quantity: 1 },
        { listingId: "l5", quantity: 1 },
      ]);
    }
  }, [route.screen]);

  return (
    <div
      className="app"
      data-palette={t.palette}
      data-density={t.density}
      data-trust={t.trust}
    >
      <TopBar
        user={{ name: "Tomi" }}
        cartCount={cartCount}
        currentScreen={route.screen}
        go={go}
        density={t.density}
        onSearch={() => go({ screen: "listings" })}
      />

      {route.screen === "home" && (
        <HomeScreen
          go={go}
          cardStyle={t.cardStyle}
          trust={t.trust}
          onAddToCart={onAddToCart}
        />
      )}
      {route.screen === "listings" && (
        <ListingsScreen
          go={go}
          cardStyle={t.cardStyle}
          trust={t.trust}
          onAddToCart={onAddToCart}
        />
      )}
      {route.screen === "detail" && (
        <ListingDetailScreen
          id={route.id}
          go={go}
          onAddToCart={onAddToCart}
          trust={t.trust}
        />
      )}
      {route.screen === "cart" && (
        <CartScreen cart={cart} setCart={setCart} go={go} />
      )}
      {route.screen === "checkout" && (
        <CheckoutScreen cart={cart} setCart={setCart} go={go} />
      )}
      {route.screen === "order" && (
        <OrderScreen go={go} justPlaced={route.justPlaced} />
      )}

      <footer
        style={{
          marginTop: "auto",
          borderTop: "1px solid var(--line)",
          background: "var(--surface)",
          padding: "40px 0",
        }}
      >
        <div className="container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr",
              gap: 40,
            }}
          >
            <div>
              <div className="brand" style={{ marginBottom: 12 }}>
                <span>forumo</span>
                <span className="brand-dot" />
                <span className="brand-tld">africa</span>
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--ink-3)",
                  maxWidth: 320,
                  lineHeight: 1.6,
                }}
              >
                A peer-to-peer marketplace where every order is held in escrow
                until you confirm receipt. Built for Lagos, Accra, Nairobi &
                Johannesburg.
              </p>
            </div>
            <div>
              <div className="h3" style={{ marginBottom: 10, fontSize: 13 }}>
                Marketplace
              </div>
              <div
                className="stack"
                style={{ gap: 6, fontSize: 13, color: "var(--ink-2)" }}
              >
                <a>Browse listings</a>
                <a>Auctions</a>
                <a>Saved items</a>
                <a>Categories</a>
              </div>
            </div>
            <div>
              <div className="h3" style={{ marginBottom: 10, fontSize: 13 }}>
                Trust
              </div>
              <div
                className="stack"
                style={{ gap: 6, fontSize: 13, color: "var(--ink-2)" }}
              >
                <a>How escrow works</a>
                <a>Verified sellers</a>
                <a>Dispute resolution</a>
                <a>Buyer protection</a>
              </div>
            </div>
            <div>
              <div className="h3" style={{ marginBottom: 10, fontSize: 13 }}>
                Company
              </div>
              <div
                className="stack"
                style={{ gap: 6, fontSize: 13, color: "var(--ink-2)" }}
              >
                <a>About</a>
                <a>Sell on Forumo</a>
                <a>Help center</a>
                <a>Contact</a>
              </div>
            </div>
          </div>
          <hr className="divider" style={{ margin: "32px 0 20px" }} />
          <div
            className="row-between"
            style={{ fontSize: 12, color: "var(--ink-3)" }}
          >
            <span>© 2026 Forumo Africa Ltd</span>
            <div className="row" style={{ gap: 16 }}>
              <a>Privacy</a>
              <a>Terms</a>
              <a>Cookies</a>
            </div>
          </div>
        </div>
      </footer>

      <Toast show={toast.show}>
        <Icon.check style={{ width: 14, height: 14, color: "var(--escrow)" }} />
        {toast.msg}
      </Toast>

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakSelect
          label="Accent palette"
          value={t.palette}
          options={["terracotta", "forest", "cobalt", "plum", "ink"]}
          onChange={(v) => setTweak("palette", v)}
        />
        <TweakRadio
          label="Density"
          value={t.density}
          options={["compact", "regular", "cozy"]}
          onChange={(v) => setTweak("density", v)}
        />
        <TweakSection label="Marketplace" />
        <TweakRadio
          label="Trust signals"
          value={t.trust}
          options={["subtle", "medium", "heavy"]}
          onChange={(v) => setTweak("trust", v)}
        />
        <TweakRadio
          label="Card style"
          value={t.cardStyle}
          options={["card", "image-led"]}
          onChange={(v) => setTweak("cardStyle", v)}
        />
        <TweakSection label="Demo jumps" />
        <TweakButton label="Home" onClick={() => go({ screen: "home" })} />
        <TweakButton
          label="Listings"
          onClick={() => go({ screen: "listings" })}
        />
        <TweakButton
          label="Listing detail"
          onClick={() => go({ screen: "detail", id: "l1" })}
        />
        <TweakButton label="Cart" onClick={() => go({ screen: "cart" })} />
        <TweakButton
          label="Checkout"
          onClick={() => {
            if (cart.length === 0) {
              setCart([
                { listingId: "l1", quantity: 1 },
                { listingId: "l3", quantity: 1 },
              ]);
            }
            go({ screen: "checkout" });
          }}
        />
        <TweakButton
          label="Order tracking"
          onClick={() => go({ screen: "order" })}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
