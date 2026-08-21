/* screens2.jsx — Cart, Checkout, Order tracking */

const { useState: useStateS2 } = React;
const { SELLERS: S2, LISTINGS: L2 } = window.FORUMO_DATA;

/* ──────────────── Cart screen ──────────────── */
function CartScreen({ cart, setCart, go }) {
  const groups = {};
  cart.forEach((item) => {
    const l = L2.find((x) => x.id === item.listingId);
    if (!l) return;
    const sid = l.sellerId;
    if (!groups[sid]) groups[sid] = { seller: S2[sid], items: [] };
    groups[sid].items.push({ ...item, listing: l });
  });

  const updateQty = (listingId, n) => {
    setCart((c) =>
      c
        .map((i) => (i.listingId === listingId ? { ...i, quantity: n } : i))
        .filter((i) => i.quantity > 0),
    );
  };
  const remove = (listingId) =>
    setCart((c) => c.filter((i) => i.listingId !== listingId));

  const grand = cart.reduce((a, i) => {
    const l = L2.find((x) => x.id === i.listingId);
    return a + (l ? l.price * i.quantity : 0);
  }, 0);

  if (cart.length === 0) {
    return (
      <main
        className="container-narrow"
        style={{ padding: "80px 32px", textAlign: "center" }}
      >
        <Icon.cart
          style={{
            width: 56,
            height: 56,
            color: "var(--ink-3)",
            margin: "0 auto 16px",
          }}
        />
        <h1 className="h1" style={{ marginBottom: 8 }}>
          Your cart is empty
        </h1>
        <p style={{ color: "var(--ink-3)", marginBottom: 24 }}>
          Browse listings to find one-of-a-kind objects from verified sellers.
        </p>
        <Btn variant="primary" onClick={() => go({ screen: "home" })}>
          Start browsing
        </Btn>
      </main>
    );
  }

  return (
    <main
      className="container"
      style={{ padding: "calc(32px * var(--sp)) calc(32px * var(--sp))" }}
    >
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <div className="eyebrow">Step 1 of 3</div>
          <h1 className="h1">
            Your cart · {cart.length} {cart.length === 1 ? "item" : "items"}
          </h1>
        </div>
      </div>
      <div
        className="row"
        style={{
          gap: 12,
          marginBottom: 32,
          fontSize: 13,
          color: "var(--ink-3)",
        }}
      >
        <span style={{ color: "var(--ink)", fontWeight: 500 }}>1 · Review</span>
        <span style={{ color: "var(--line-2)" }}>—</span>
        <span>2 · Address & payment</span>
        <span style={{ color: "var(--line-2)" }}>—</span>
        <span>3 · Track in escrow</span>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 32 }}
      >
        <div className="stack" style={{ gap: 20 }}>
          {Object.keys(groups).length > 1 && (
            <div
              className="card card-pad"
              style={{
                background: "var(--accent-bg)",
                border: "none",
                padding: 14,
              }}
            >
              <div
                className="row"
                style={{ gap: 10, fontSize: 13, color: "var(--accent-2)" }}
              >
                <Icon.package style={{ width: 16, height: 16 }} />
                <span>
                  <strong>
                    {Object.keys(groups).length} sellers in your cart
                  </strong>{" "}
                  — each ships separately and is held in its own escrow.
                </span>
              </div>
            </div>
          )}

          {Object.values(groups).map((g) => {
            const groupTotal = g.items.reduce(
              (a, i) => a + i.listing.price * i.quantity,
              0,
            );
            return (
              <div key={g.seller.id} className="seller-group">
                <div className="seller-group-header">
                  <div className="row" style={{ gap: 12 }}>
                    <Avatar name={g.seller.name} size={36} />
                    <div>
                      <div className="row" style={{ gap: 6 }}>
                        <span style={{ fontWeight: 500 }}>{g.seller.shop}</span>
                        <VerifiedBadge />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        Ships from {g.seller.location} · {g.seller.responseTime}
                      </div>
                    </div>
                  </div>
                  <Pill tone="escrow">
                    <Icon.lock style={{ width: 11, height: 11 }} />
                    Escrow #{g.seller.id.toUpperCase()}-
                    {Math.floor(Math.random() * 9000 + 1000)}
                  </Pill>
                </div>
                <div className="seller-group-body">
                  {g.items.map((i) => (
                    <div key={i.listingId} className="cart-line">
                      <Placeholder label={i.listing.placeholder} />
                      <div className="stack" style={{ gap: 6 }}>
                        <div style={{ fontWeight: 500 }}>{i.listing.title}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                          {i.listing.condition}
                        </div>
                        <div className="row" style={{ gap: 12, marginTop: 4 }}>
                          <Qty
                            value={i.quantity}
                            onChange={(n) => updateQty(i.listingId, n)}
                          />
                          <button
                            onClick={() => remove(i.listingId)}
                            style={{
                              fontSize: 12,
                              color: "var(--ink-3)",
                              textDecoration: "underline",
                            }}
                          >
                            Remove
                          </button>
                          <button
                            style={{
                              fontSize: 12,
                              color: "var(--ink-3)",
                              textDecoration: "underline",
                            }}
                          >
                            Save for later
                          </button>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Money
                          cents={i.listing.price * i.quantity}
                          currency={i.listing.currency}
                          size={15}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="seller-group-footer">
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                    Shipping calculated at checkout
                  </span>
                  <div className="row" style={{ gap: 10 }}>
                    <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
                      Subtotal from {g.seller.shop}
                    </span>
                    <Money cents={groupTotal} currency="NGN" size={15} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside style={{ position: "sticky", top: 100, alignSelf: "start" }}>
          <div className="card card-pad">
            <h3 className="h3" style={{ marginBottom: 14 }}>
              Order summary
            </h3>
            <div className="stack" style={{ gap: 8, fontSize: 14 }}>
              <div className="row-between">
                <span className="muted">Items ({cart.length})</span>
                <Money cents={grand} currency="NGN" />
              </div>
              <div className="row-between">
                <span className="muted">Shipping</span>
                <span className="muted">Calculated next</span>
              </div>
              <div className="row-between">
                <span className="muted">Forumo fee</span>
                <Money cents={0} currency="NGN" />
              </div>
            </div>
            <hr className="divider" style={{ margin: "14px 0" }} />
            <div className="row-between" style={{ marginBottom: 16 }}>
              <span style={{ fontWeight: 500 }}>Order total</span>
              <span style={{ fontSize: 20 }}>
                <Money cents={grand} currency="NGN" size={20} />
              </span>
            </div>
            <Btn
              variant="primary"
              size="lg"
              block
              onClick={() => go({ screen: "checkout" })}
              iconRight={<Icon.arrowRight style={{ width: 16, height: 16 }} />}
            >
              Proceed to checkout
            </Btn>
            <div
              style={{
                marginTop: 14,
                padding: 12,
                background: "var(--escrow-bg)",
                borderRadius: 10,
                fontSize: 12,
                color: "var(--escrow)",
              }}
            >
              <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                <Icon.lock style={{ width: 14, height: 14 }} />
                <strong style={{ fontWeight: 600 }}>
                  Protected by Forumo Escrow
                </strong>
              </div>
              Funds released to seller only after you confirm receipt. 7-day
              window to open a dispute.
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ──────────────── Checkout screen ──────────────── */
function CheckoutScreen({ cart, setCart, go }) {
  const [addr, setAddr] = useStateS2({
    name: "Tomi Adeleke",
    line1: "14 Kingsway Road, Ikoyi",
    city: "Lagos",
    country: "Nigeria",
    phone: "+234 802 555 0142",
  });
  const [payment, setPayment] = useStateS2("card");
  const [placing, setPlacing] = useStateS2(false);

  const groups = {};
  cart.forEach((item) => {
    const l = L2.find((x) => x.id === item.listingId);
    if (!l) return;
    const sid = l.sellerId;
    if (!groups[sid]) groups[sid] = { seller: S2[sid], items: [] };
    groups[sid].items.push({ ...item, listing: l });
  });
  const grand = cart.reduce((a, i) => {
    const l = L2.find((x) => x.id === i.listingId);
    return a + (l ? l.price * i.quantity : 0);
  }, 0);
  const shipping = Object.keys(groups).length * 1250000;
  const total = grand + shipping;

  const placeOrder = () => {
    setPlacing(true);
    setTimeout(() => {
      setPlacing(false);
      setCart([]);
      go({ screen: "order", justPlaced: true });
    }, 1200);
  };

  return (
    <main
      className="container"
      style={{ padding: "calc(32px * var(--sp)) calc(32px * var(--sp))" }}
    >
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => go({ screen: "cart" })}
          className="row"
          style={{
            gap: 6,
            fontSize: 13,
            color: "var(--ink-3)",
            marginBottom: 8,
          }}
        >
          <Icon.arrowLeft style={{ width: 14, height: 14 }} />
          Back to cart
        </button>
        <div className="eyebrow">Step 2 of 3</div>
        <h1 className="h1">Checkout</h1>
      </div>
      <div
        className="row"
        style={{
          gap: 12,
          marginBottom: 32,
          fontSize: 13,
          color: "var(--ink-3)",
        }}
      >
        <span style={{ color: "var(--escrow)", fontWeight: 500 }}>
          1 · Review ✓
        </span>
        <span style={{ color: "var(--line-2)" }}>—</span>
        <span style={{ color: "var(--ink)", fontWeight: 500 }}>
          2 · Address & payment
        </span>
        <span style={{ color: "var(--line-2)" }}>—</span>
        <span>3 · Track in escrow</span>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32 }}
      >
        <div className="stack" style={{ gap: 20 }}>
          <div className="card card-pad" style={{ padding: 24 }}>
            <div className="row-between" style={{ marginBottom: 16 }}>
              <h2 className="h2">Delivery address</h2>
              <Pill tone="escrow" dot>
                Saved
              </Pill>
            </div>
            <div
              className="grid"
              style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}
            >
              <div className="field">
                <label>Full name</label>
                <input
                  value={addr.name}
                  onChange={(e) => setAddr({ ...addr, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Phone</label>
                <input
                  value={addr.phone}
                  onChange={(e) => setAddr({ ...addr, phone: e.target.value })}
                />
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <label>Address line</label>
                <input
                  value={addr.line1}
                  onChange={(e) => setAddr({ ...addr, line1: e.target.value })}
                />
              </div>
              <div className="field">
                <label>City</label>
                <input
                  value={addr.city}
                  onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Country</label>
                <select
                  value={addr.country}
                  onChange={(e) =>
                    setAddr({ ...addr, country: e.target.value })
                  }
                >
                  <option>Nigeria</option>
                  <option>Ghana</option>
                  <option>Kenya</option>
                  <option>South Africa</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card card-pad" style={{ padding: 24 }}>
            <h2 className="h2" style={{ marginBottom: 16 }}>
              Payment method
            </h2>
            <div className="stack" style={{ gap: 10 }}>
              {[
                {
                  id: "card",
                  label: "Card",
                  sub: "Visa, Mastercard, Verve · processed by Stripe",
                  icon: <Icon.card />,
                },
                {
                  id: "transfer",
                  label: "Bank transfer",
                  sub: "Pay from any Nigerian bank · 1–2 min confirmation",
                  icon: <Icon.scale />,
                },
                {
                  id: "mobile",
                  label: "Mobile money",
                  sub: "M-Pesa, MTN MoMo, Airtel Money",
                  icon: <Icon.shield />,
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className="row"
                  style={{
                    gap: 14,
                    padding: 16,
                    borderRadius: 10,
                    border: `1.5px solid ${payment === opt.id ? "var(--ink)" : "var(--line)"}`,
                    cursor: "pointer",
                    background:
                      payment === opt.id
                        ? "var(--surface-2)"
                        : "var(--surface)",
                  }}
                >
                  <input
                    type="radio"
                    checked={payment === opt.id}
                    onChange={() => setPayment(opt.id)}
                    style={{ accentColor: "var(--ink)" }}
                  />
                  {React.cloneElement(opt.icon, {
                    style: { width: 22, height: 22, color: "var(--ink-3)" },
                  })}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      {opt.sub}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            {payment === "card" && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: "var(--surface-2)",
                  borderRadius: 10,
                }}
              >
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}
                >
                  <div className="field" style={{ gridColumn: "span 2" }}>
                    <label>Card number</label>
                    <input placeholder="4242 4242 4242 4242" />
                  </div>
                  <div className="field">
                    <label>Expiry</label>
                    <input placeholder="MM / YY" />
                  </div>
                  <div className="field">
                    <label>CVC</label>
                    <input placeholder="123" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card card-pad" style={{ padding: 24 }}>
            <h2 className="h2" style={{ marginBottom: 16 }}>
              Review your order
            </h2>
            <div className="stack" style={{ gap: 16 }}>
              {Object.values(groups).map((g) => {
                const sub = g.items.reduce(
                  (a, i) => a + i.listing.price * i.quantity,
                  0,
                );
                return (
                  <div
                    key={g.seller.id}
                    style={{
                      padding: 16,
                      background: "var(--surface-2)",
                      borderRadius: 10,
                    }}
                  >
                    <div className="row-between" style={{ marginBottom: 12 }}>
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar name={g.seller.name} size={28} />
                        <span style={{ fontWeight: 500, fontSize: 14 }}>
                          {g.seller.shop}
                        </span>
                        <VerifiedBadge />
                      </div>
                      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        Ships{" "}
                        {new Date(Date.now() + 86400000 * 4).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" },
                        )}
                        –
                        {new Date(Date.now() + 86400000 * 7).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" },
                        )}
                      </span>
                    </div>
                    {g.items.map((i) => (
                      <div
                        key={i.listingId}
                        className="row"
                        style={{ gap: 12, padding: "6px 0", fontSize: 13 }}
                      >
                        <Placeholder
                          style={{ width: 48, height: 48, borderRadius: 6 }}
                        />
                        <div style={{ flex: 1 }}>{i.listing.title}</div>
                        <span
                          className="mono"
                          style={{ color: "var(--ink-3)" }}
                        >
                          ×{i.quantity}
                        </span>
                        <Money cents={i.listing.price * i.quantity} />
                      </div>
                    ))}
                    <div
                      className="row-between"
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: "1px solid var(--line)",
                        fontSize: 13,
                      }}
                    >
                      <span>
                        Items + ship from {g.seller.location.split(",")[0]}
                      </span>
                      <span>
                        <Money cents={sub + 1250000} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside style={{ position: "sticky", top: 100, alignSelf: "start" }}>
          <div className="card card-pad">
            <h3 className="h3" style={{ marginBottom: 14 }}>
              Order total
            </h3>
            <div className="stack" style={{ gap: 8, fontSize: 14 }}>
              <div className="row-between">
                <span className="muted">Items</span>
                <Money cents={grand} />
              </div>
              <div className="row-between">
                <span className="muted">
                  Shipping ({Object.keys(groups).length} sellers)
                </span>
                <Money cents={shipping} />
              </div>
              <div className="row-between">
                <span className="muted">Forumo fee</span>
                <Money cents={0} />
              </div>
            </div>
            <hr className="divider" style={{ margin: "14px 0" }} />
            <div className="row-between" style={{ marginBottom: 16 }}>
              <span style={{ fontWeight: 500 }}>Total</span>
              <Money cents={total} size={20} />
            </div>
            <Btn
              variant="primary"
              size="lg"
              block
              onClick={placeOrder}
              disabled={placing}
            >
              {placing
                ? "Placing…"
                : `Place order · ${(total / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </Btn>
            <div
              style={{
                marginTop: 14,
                padding: 12,
                background: "var(--escrow-bg)",
                borderRadius: 10,
                fontSize: 12,
                color: "var(--escrow)",
              }}
            >
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <Icon.lock style={{ width: 14, height: 14 }} />
                <strong style={{ fontWeight: 600 }}>What happens next</strong>
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
                <li>Funds held by Forumo Escrow</li>
                <li>Seller ships within 48h</li>
                <li>You confirm — seller is paid</li>
              </ol>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ──────────────── Order tracking ──────────────── */
function OrderScreen({ go, justPlaced }) {
  const [step, setStep] = useStateS2(justPlaced ? 0 : 1);
  const [showToast, setShowToast] = useStateS2(justPlaced || false);

  React.useEffect(() => {
    if (justPlaced) {
      const t = setTimeout(() => setShowToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, []);

  const order = {
    number: "FMO-92831",
    placed: "Today, 10:42",
    seller: S2.s1,
    items: [{ listing: L2[0], qty: 1 }],
    address: "14 Kingsway Road, Ikoyi, Lagos",
    payment: "Visa •• 4242",
    subtotal: L2[0].price,
    shipping: 1250000,
  };
  const total = order.subtotal + order.shipping;
  const stepLabels = [
    { title: "Paid", body: "Funds locked in Forumo Escrow." },
    { title: "Shipped", body: "Seller has handed package to courier." },
    { title: "Delivered", body: "You have 72 hours to confirm or dispute." },
    { title: "Released", body: "Funds paid to seller. Order complete." },
  ];

  return (
    <main
      className="container-narrow"
      style={{ padding: "calc(32px * var(--sp)) calc(32px * var(--sp))" }}
    >
      {justPlaced && (
        <div
          className="card card-pad fade-up"
          style={{
            background: "var(--escrow-bg)",
            border: "1px solid var(--escrow)",
            marginBottom: 24,
            padding: 18,
          }}
        >
          <div className="row" style={{ gap: 14 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "var(--escrow)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon.check style={{ width: 18, height: 18 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: "var(--escrow)" }}>
                Order placed — funds in escrow
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
                Order <span className="mono">{order.number}</span> ·
                confirmation sent to your email
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div className="eyebrow">Step 3 of 3 · Track in escrow</div>
        <div className="row-between">
          <h1 className="h1">
            Order{" "}
            <span className="mono" style={{ fontSize: 22 }}>
              {order.number}
            </span>
          </h1>
          <Pill tone="escrow">
            <Icon.lock style={{ width: 11, height: 11 }} />
            Escrow protected
          </Pill>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
          Placed {order.placed} · Est. delivery{" "}
          {new Date(Date.now() + 86400000 * 5).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      <section
        className="card card-pad"
        style={{ padding: 32, marginBottom: 24 }}
      >
        <div className="row-between" style={{ marginBottom: 20 }}>
          <h2 className="h2">Escrow status</h2>
          <div
            className="row"
            style={{ gap: 6, fontSize: 12, color: "var(--ink-3)" }}
          >
            <span>Simulate:</span>
            {stepLabels.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="chip"
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  background: step === i ? "var(--ink)" : "var(--surface)",
                  color: step === i ? "var(--bg)" : "var(--ink-2)",
                  borderColor: step === i ? "var(--ink)" : "var(--line)",
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        <EscrowTimeline step={step} />
        <div
          style={{
            marginTop: 28,
            padding: 18,
            background: "var(--escrow-bg)",
            borderRadius: 12,
          }}
        >
          <div className="row" style={{ gap: 14 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--escrow)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {step === 0 && <Icon.card style={{ width: 16, height: 16 }} />}
              {step === 1 && <Icon.truck style={{ width: 16, height: 16 }} />}
              {step === 2 && <Icon.package style={{ width: 16, height: 16 }} />}
              {step === 3 && <Icon.check style={{ width: 16, height: 16 }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: "var(--escrow)" }}>
                {stepLabels[step].title}
              </div>
              <div
                style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}
              >
                {stepLabels[step].body}
              </div>
            </div>
            {step === 2 && <Btn variant="primary">Confirm receipt</Btn>}
            {step === 1 && <Btn variant="ghost">Track package</Btn>}
            {step < 3 && <Btn variant="soft">Open dispute</Btn>}
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 20,
          marginBottom: 24,
        }}
      >
        <div className="card card-pad" style={{ padding: 24 }}>
          <h3 className="h3" style={{ marginBottom: 14 }}>
            In this order
          </h3>
          {order.items.map((i, idx) => (
            <div key={idx} className="row" style={{ gap: 14 }}>
              <Placeholder
                label={i.listing.placeholder}
                style={{ width: 88, height: 88, borderRadius: 10 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{i.listing.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  {i.listing.condition}
                </div>
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  <Pill>×{i.qty}</Pill>
                  <span style={{ marginLeft: "auto" }}>
                    <Money cents={i.listing.price} />
                  </span>
                </div>
              </div>
            </div>
          ))}
          <hr className="divider" style={{ margin: "16px 0" }} />
          <div className="stack" style={{ gap: 6, fontSize: 13 }}>
            <div className="row-between">
              <span className="muted">Items</span>
              <Money cents={order.subtotal} />
            </div>
            <div className="row-between">
              <span className="muted">Shipping</span>
              <Money cents={order.shipping} />
            </div>
            <div
              className="row-between"
              style={{
                marginTop: 6,
                paddingTop: 8,
                borderTop: "1px solid var(--line)",
              }}
            >
              <strong>Total in escrow</strong>
              <Money cents={total} size={16} />
            </div>
          </div>
        </div>

        <div className="card card-pad" style={{ padding: 24 }}>
          <h3 className="h3" style={{ marginBottom: 14 }}>
            Seller
          </h3>
          <div className="row" style={{ gap: 12, marginBottom: 14 }}>
            <Avatar name={order.seller.name} size={44} />
            <div>
              <div className="row" style={{ gap: 6 }}>
                <span style={{ fontWeight: 500 }}>{order.seller.shop}</span>
                <VerifiedBadge />
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                {order.seller.responseTime}
              </div>
            </div>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <Btn
              variant="soft"
              block
              icon={<Icon.chat style={{ width: 14, height: 14 }} />}
            >
              Message seller
            </Btn>
            <Btn variant="ghost" block>
              Visit shop
            </Btn>
          </div>
          <hr className="divider" style={{ margin: "16px 0" }} />
          <h3 className="h3" style={{ marginBottom: 10 }}>
            Shipping to
          </h3>
          <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
            Tomi Adeleke
            <br />
            {order.address}
            <br />
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--ink-3)" }}
            >
              +234 802 555 0142
            </span>
          </div>
        </div>
      </section>

      <div
        className="row"
        style={{ gap: 10, justifyContent: "center", marginBottom: 40 }}
      >
        <Btn variant="ghost" onClick={() => go({ screen: "home" })}>
          Continue shopping
        </Btn>
        <Btn variant="ghost">Download receipt</Btn>
      </div>

      <Toast show={showToast}>
        <Icon.check style={{ width: 14, height: 14, color: "var(--escrow)" }} />
        Order placed · escrow active
      </Toast>
    </main>
  );
}

window.FORUMO_SCREENS_2 = { CartScreen, CheckoutScreen, OrderScreen };
