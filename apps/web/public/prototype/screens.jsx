/* screens.jsx — Forumo screen components */

const { useState: useStateS, useEffect: useEffectS, useMemo: useMemoS } = React;
const { SELLERS, LISTINGS, CATEGORIES, REVIEWS } = window.FORUMO_DATA;

/* ────────────────────── Top bar ────────────────────── */
function TopBar({ user, cartCount, currentScreen, go, density, onSearch }) {
  const [q, setQ] = useStateS('');
  return (
    <>
      <header className="topbar">
        <div className="container">
          <div className="topbar-inner">
            <div className="row">
              <a className="brand" onClick={() => go({ screen: 'home' })} style={{ cursor: 'pointer' }}>
                <span>forumo</span><span className="brand-dot"/><span className="brand-tld">africa</span>
              </a>
              <a className="nav-link" style={{ paddingLeft: 8 }}>
                <Icon.pin/>
                <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>Deliver to</span>
                  <span>Lagos</span>
                </span>
              </a>
            </div>
            <form className="search" onSubmit={(e) => { e.preventDefault(); onSearch(q); }}>
              <Icon.search/>
              <input placeholder="Search restored, vintage, hand-made…" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="search-cat" defaultValue="all">
                <option value="all">All categories</option>
                {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
              </select>
              <button className="search-btn" type="submit">Search</button>
            </form>
            <div className="nav-actions">
              <a className="nav-link"><Icon.heart/></a>
              <a className="nav-link" onClick={() => go({ screen: 'order' })}>
                <Icon.package/>
                <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>Your</span>
                  <span>Orders</span>
                </span>
              </a>
              <a className="nav-link" onClick={() => go({ screen: 'cart' })} style={{ position: 'relative' }}>
                <Icon.cart/>
                {cartCount > 0 && <span className="cart-badge" style={{ position: 'absolute', top: 2, right: 2 }}>{cartCount}</span>}
                <span>Cart</span>
              </a>
            </div>
          </div>
        </div>
      </header>
      <nav className="subnav">
        <div className="container">
          <div className="subnav-inner">
            <a className={`subnav-item ${currentScreen==='home'?'active':''}`} onClick={() => go({ screen: 'home' })}>Browse</a>
            <a className={`subnav-item ${currentScreen==='listings'?'active':''}`} onClick={() => go({ screen: 'listings' })}>All listings</a>
            <a className="subnav-item">Auctions</a>
            <a className="subnav-item">Saved</a>
            <a className="subnav-item">Messages</a>
            <a className="subnav-item">How escrow works</a>
            <a className="subnav-item sell" style={{ marginLeft: 'auto' }}>+ Sell on Forumo</a>
          </div>
        </div>
      </nav>
    </>
  );
}

/* ────────────────────── Listing card ────────────────────── */
function ListingCard({ listing, cardStyle, trust, go, onAddToCart }) {
  const seller = SELLERS[listing.sellerId];
  return (
    <article
      className={`listing-card card card-hover fade-up`}
      data-style={cardStyle}
      onClick={() => go({ screen: 'detail', id: listing.id })}
    >
      <Placeholder label={listing.placeholder}/>
      <div className="body">
        <div className="title">{listing.title}</div>
        <div className="meta">
          <Stars value={seller.rating}/>
          <span>{seller.shop}</span>
          {trust !== 'subtle' && seller.verified && <Icon.check style={{ width: 10, height: 10, color: 'var(--escrow)' }}/>}
        </div>
        <div className="row-between" style={{ marginTop: 6 }}>
          <span className="price"><Money cents={listing.price} currency={listing.currency}/></span>
          {trust === 'heavy' && (
            <span style={{ fontSize: 10, color: 'var(--escrow)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon.lock style={{ width: 10, height: 10 }}/>Escrow
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/* ────────────────────── Home / browse ────────────────────── */
function HomeScreen({ go, cardStyle, trust, onAddToCart }) {
  return (
    <main className="container" style={{ padding: 'calc(40px * var(--sp)) calc(32px * var(--sp))' }}>
      {/* Hero */}
      <section style={{
        display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 32, alignItems: 'center',
        marginBottom: 'calc(56px * var(--sp))'
      }}>
        <div className="stack" style={{ gap: 20 }}>
          <div className="eyebrow">Forumo — Africa's escrow marketplace</div>
          <h1 className="h-display">
            Buy from real people.<br/>
            <span style={{ color: 'var(--accent)' }}>Pay only when it lands.</span>
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-2)', maxWidth: 460, lineHeight: 1.6 }}>
            Vetted sellers across Lagos, Accra, Nairobi and Johannesburg.
            Funds sit in escrow until you confirm the package matches the listing — every order.
          </p>
          <div className="row" style={{ gap: 10 }}>
            <Btn variant="primary" size="lg" iconRight={<Icon.arrowRight style={{width:16,height:16}}/>} onClick={() => go({ screen: 'listings' })}>Browse listings</Btn>
            <Btn variant="ghost" size="lg">How escrow works</Btn>
          </div>
          {trust !== 'subtle' && (
            <div className="row home-trust-pillar" style={{ gap: 24, marginTop: 8, color: 'var(--ink-3)', fontSize: 13 }}>
              <span className="row" style={{ gap: 6 }}><Icon.lock style={{width:14,height:14}}/>2,431 orders protected this week</span>
              <span className="row" style={{ gap: 6 }}><Icon.shield style={{width:14,height:14}}/>98% of disputes resolved &lt; 48h</span>
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <Placeholder label="hero — curated objects" style={{ aspectRatio: '5/4', borderRadius: 'var(--r-xl)' }}/>
          <div style={{
            position: 'absolute', bottom: 20, left: 20, right: 20,
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 14, padding: 14,
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 12px 30px -16px rgba(0,0,0,0.18)'
          }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--escrow-bg)', color: 'var(--escrow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon.lock style={{width:18,height:18}}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Escrow released — Order ORD-92831</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>Paid · Shipped · Delivered · Released · 4h 22m</div>
            </div>
            <span className="pill pill-escrow"><Icon.check style={{width:10,height:10}}/>Done</span>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section style={{ marginBottom: 'calc(56px * var(--sp))' }}>
        <TrustStrip/>
      </section>

      {/* Category chips */}
      <section style={{ marginBottom: 'calc(40px * var(--sp))' }}>
        <SectionHeading eyebrow="Browse" title="By category" action="See all" onAction={() => go({ screen: 'listings' })}/>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {CATEGORIES.map((c, i) => (
            <button key={c} className={`chip ${i===1?'active':''}`}>{c}</button>
          ))}
        </div>
      </section>

      {/* Featured grid */}
      <section style={{ marginBottom: 'calc(56px * var(--sp))' }}>
        <SectionHeading eyebrow="Just listed" title="New from verified sellers" action="View all listings" onAction={() => go({ screen: 'listings' })}/>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {LISTINGS.slice(0, 4).map(l => (
            <ListingCard key={l.id} listing={l} cardStyle={cardStyle} trust={trust} go={go} onAddToCart={onAddToCart}/>
          ))}
        </div>
      </section>

      {/* Editorial row */}
      <section className="card card-pad" style={{ marginBottom: 'calc(56px * var(--sp))', padding: 'calc(40px * var(--sp))', background: 'var(--surface-2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40, alignItems: 'center' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Seller spotlight</div>
            <h2 className="h1" style={{ marginBottom: 12 }}>Ile Atelier — handwoven textiles from Ibadan</h2>
            <p style={{ color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>
              Sade Balogun has been listing on Forumo since 2024.
              Each aso-oke piece is woven on a pit loom and dyed with indigo
              from her cooperative — listed once, shipped within 48 hours.
            </p>
            <div className="row" style={{ gap: 14 }}>
              <Avatar name="Sade Balogun" size={40}/>
              <div>
                <div style={{ fontWeight: 500 }}>Sade Balogun · <VerifiedBadge/></div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>5.0 · 78 reviews · Replies in ~2h</div>
              </div>
              <Btn variant="ghost" size="sm" style={{ marginLeft: 'auto' }}>Visit shop</Btn>
            </div>
          </div>
          <Placeholder label="weaving in progress" style={{ aspectRatio: '4/3', borderRadius: 'var(--r-lg)' }}/>
        </div>
      </section>

      {/* More listings */}
      <section style={{ marginBottom: 60 }}>
        <SectionHeading eyebrow="Trending" title="Watched most this week"/>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {LISTINGS.slice(4, 8).map(l => (
            <ListingCard key={l.id} listing={l} cardStyle={cardStyle} trust={trust} go={go} onAddToCart={onAddToCart}/>
          ))}
        </div>
      </section>
    </main>
  );
}

/* ────────────────────── Listings / search results ────────────────────── */
function ListingsScreen({ go, cardStyle, trust, onAddToCart }) {
  const [sort, setSort] = useStateS('relevance');
  const [activeCat, setActiveCat] = useStateS('All');
  const filtered = activeCat === 'All' ? LISTINGS : LISTINGS.filter(l => l.category === activeCat);

  return (
    <main className="container" style={{ padding: 'calc(32px * var(--sp)) calc(32px * var(--sp))' }}>
      <div className="row-between" style={{ marginBottom: 24 }}>
        <div>
          <div className="eyebrow">All listings</div>
          <h1 className="h1">{filtered.length} items</h1>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <select className="btn btn-ghost btn-sm" value={sort} onChange={e=>setSort(e.target.value)} style={{ minWidth: 160 }}>
            <option value="relevance">Sort: Relevance</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="date_new">Newest first</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 32 }}>
        <aside className="stack" style={{ gap: 24, position: 'sticky', top: 90, alignSelf: 'start' }}>
          <div>
            <div className="h3" style={{ marginBottom: 10 }}>Category</div>
            <div className="stack" style={{ gap: 6 }}>
              {CATEGORIES.map(c => (
                <label key={c} className="row" style={{ gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="cat" checked={activeCat === c} onChange={() => setActiveCat(c)}/>
                  {c}
                </label>
              ))}
            </div>
          </div>
          <hr className="divider"/>
          <div>
            <div className="h3" style={{ marginBottom: 10 }}>Price (NGN)</div>
            <div className="row" style={{ gap: 8 }}>
              <input placeholder="Min" style={{ height: 36, padding: '0 10px', border: '1px solid var(--line-2)', borderRadius: 8, background: 'var(--surface)', width: '100%' }}/>
              <input placeholder="Max" style={{ height: 36, padding: '0 10px', border: '1px solid var(--line-2)', borderRadius: 8, background: 'var(--surface)', width: '100%' }}/>
            </div>
          </div>
          <hr className="divider"/>
          <div>
            <div className="h3" style={{ marginBottom: 10 }}>Condition</div>
            <div className="stack" style={{ gap: 6 }}>
              {['New from maker','Excellent','Very good','Good','Fair'].map(c => (
                <label key={c} className="row" style={{ gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox"/>{c}
                </label>
              ))}
            </div>
          </div>
          <hr className="divider"/>
          <div>
            <div className="h3" style={{ marginBottom: 10 }}>Seller</div>
            <div className="stack" style={{ gap: 6 }}>
              <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" defaultChecked/> Verified only</label>
              <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox"/> Replies &lt; 1h</label>
              <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox"/> 4.5+ rating</label>
            </div>
          </div>
        </aside>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {filtered.map(l => (
            <ListingCard key={l.id} listing={l} cardStyle={cardStyle} trust={trust} go={go} onAddToCart={onAddToCart}/>
          ))}
        </div>
      </div>
    </main>
  );
}

/* ────────────────────── Listing detail ────────────────────── */
function ListingDetailScreen({ id, go, onAddToCart, trust }) {
  const listing = LISTINGS.find(l => l.id === id) || LISTINGS[0];
  const seller = SELLERS[listing.sellerId];
  const [qty, setQty] = useStateS(1);
  const [tab, setTab] = useStateS('description');

  return (
    <main className="container" style={{ padding: 'calc(28px * var(--sp)) calc(32px * var(--sp))' }}>
      <div className="row" style={{ gap: 8, fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>
        <a onClick={() => go({ screen: 'home' })} style={{ cursor: 'pointer' }}>Browse</a>
        <span>/</span>
        <a onClick={() => go({ screen: 'listings' })} style={{ cursor: 'pointer' }}>{listing.category}</a>
        <span>/</span>
        <span style={{ color: 'var(--ink-2)' }}>{listing.title}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 40, marginBottom: 48 }}>
        <div>
          <Placeholder label={listing.placeholder} style={{ aspectRatio: '1/1', borderRadius: 'var(--r-lg)', marginBottom: 12 }}/>
          <div className="row" style={{ gap: 10 }}>
            {[0,1,2,3].map(i => (
              <Placeholder key={i} label={`${i+1}`} style={{ width: 80, height: 80, borderRadius: 8, flexShrink: 0, opacity: i===0?1:0.7, border: i===0?'2px solid var(--ink)':'none' }}/>
            ))}
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 8 }}>
            <Pill tone="accent">{listing.category}</Pill>
            <Pill>Posted {listing.posted}</Pill>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 'auto' }}>👁 {listing.watching} watching</span>
          </div>
          <h1 className="h1" style={{ marginBottom: 0 }}>{listing.title}</h1>
          <div className="row" style={{ gap: 10 }}>
            <Stars value={seller.rating}/>
            <a style={{ fontSize: 13, color: 'var(--ink-2)' }}>{seller.rating} · {seller.reviews} reviews</a>
          </div>
          <hr className="divider"/>
          <div>
            <div className="row" style={{ gap: 12, alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 500 }}>
                <Money cents={listing.price} currency={listing.currency}/>
              </span>
              {trust !== 'subtle' && (
                <span className="pill pill-escrow"><Icon.lock style={{width:11,height:11}}/>Escrow protected</span>
              )}
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6 }}>
              Your funds are held by Forumo until you confirm the item matches the listing.
              <a style={{ color: 'var(--accent)', cursor: 'pointer' }}> How it works →</a>
            </p>
          </div>
          <div className="card" style={{ padding: 14, background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>Condition</div>
            <div style={{ fontWeight: 500 }}>{listing.condition}</div>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>Quantity</div>
              <Qty value={qty} onChange={setQty} max={listing.stock}/>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>
              {listing.stock === 1 ? 'Only 1 available — one-of-one' : `${listing.stock} in stock`}
            </div>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <Btn variant="primary" size="lg" block onClick={() => onAddToCart(listing, qty)}>Add to cart</Btn>
            <Btn variant="ink" size="lg" block onClick={() => { onAddToCart(listing, qty); go({ screen: 'cart' }); }}>Buy now with escrow</Btn>
            <div className="row" style={{ gap: 8 }}>
              <Btn variant="ghost" size="sm" icon={<Icon.chat style={{width:14,height:14}}/>}>Message seller</Btn>
              <Btn variant="ghost" size="sm" icon={<Icon.scale style={{width:14,height:14}}/>}>Make offer</Btn>
              <Btn variant="ghost" size="sm" icon={<Icon.heart style={{width:14,height:14}}/>}>Save</Btn>
            </div>
          </div>
          <div className="row" style={{ gap: 16, color: 'var(--ink-2)', fontSize: 13, padding: '12px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
            <Icon.truck style={{ width: 18, height: 18, color: 'var(--ink-3)' }}/>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--ink)', fontWeight: 500 }}>Ships from {seller.location}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Standard 3-5 days · Insured · Free returns within 7 days</div>
            </div>
          </div>
        </div>
      </div>

      <section className="card card-pad" style={{ marginBottom: 32, padding: 24 }}>
        <div className="row" style={{ gap: 16 }}>
          <Avatar name={seller.name} size={56}/>
          <div style={{ flex: 1 }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 500 }}>{seller.shop}</span>
              <VerifiedBadge/>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{seller.name} · {seller.location} · Joined {seller.joined}</div>
            <div className="row" style={{ gap: 16, marginTop: 8, fontSize: 13 }}>
              <span><strong>{seller.rating}</strong> rating</span>
              <span><strong>{seller.reviews}</strong> reviews</span>
              <span className="muted">{seller.responseTime}</span>
            </div>
          </div>
          <Btn variant="ghost">Visit shop</Btn>
          <Btn variant="soft">Message</Btn>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <div className="row" style={{ gap: 0, borderBottom: '1px solid var(--line)', marginBottom: 24 }}>
          {['description','condition','shipping','reviews'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '12px 18px', fontSize: 14, fontWeight: 500,
              color: tab===t?'var(--ink)':'var(--ink-3)',
              borderBottom: tab===t?'2px solid var(--ink)':'2px solid transparent',
              textTransform: 'capitalize', marginBottom: -1,
            }}>{t}{t==='reviews'?` (${REVIEWS.length})`:''}</button>
          ))}
        </div>

        {tab === 'description' && (
          <div className="stack" style={{ maxWidth: 720, gap: 14, fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.7 }}>
            <p>Acquired from an estate in Surulere and fully restored over six weeks: lacquer stripped, splits filled, brass pulls polished, interior re-lined with bespoke cotton.</p>
            <p>Dimensions: 180 × 76 × 45 cm. Solid walnut with sliding doors. Sits flat on level floors. Interior has three cedar-lined shelves on the right.</p>
            <p>Pickup welcome in Lagos. White-glove crating available for shipping anywhere in Nigeria — quoted on request.</p>
          </div>
        )}
        {tab === 'condition' && (
          <div className="card card-pad" style={{ maxWidth: 720 }}>
            <div className="row-between"><span>Frame</span><Pill tone="escrow">Excellent</Pill></div>
            <hr className="divider" style={{ margin: '14px 0' }}/>
            <div className="row-between"><span>Finish</span><Pill tone="escrow">Refinished</Pill></div>
            <hr className="divider" style={{ margin: '14px 0' }}/>
            <div className="row-between"><span>Hardware</span><Pill>Original</Pill></div>
            <hr className="divider" style={{ margin: '14px 0' }}/>
            <div className="row-between"><span>Interior</span><Pill>Re-lined</Pill></div>
          </div>
        )}
        {tab === 'shipping' && (
          <div className="stack" style={{ maxWidth: 720, gap: 16 }}>
            <div className="row" style={{ gap: 12 }}>
              <Icon.truck style={{ width: 20, color: 'var(--ink-3)' }}/>
              <div>
                <div style={{ fontWeight: 500 }}>Standard delivery — NGN 12,500</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>3–5 business days · Insured · Tracked</div>
              </div>
            </div>
            <div className="row" style={{ gap: 12 }}>
              <Icon.shield style={{ width: 20, color: 'var(--ink-3)' }}/>
              <div>
                <div style={{ fontWeight: 500 }}>White-glove crating — quoted on request</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>For large or fragile items · Message seller for pricing</div>
              </div>
            </div>
          </div>
        )}
        {tab === 'reviews' && (
          <div className="stack" style={{ maxWidth: 720, gap: 16 }}>
            {REVIEWS.map((r, i) => (
              <div key={i} className="card card-pad">
                <div className="row" style={{ gap: 10, marginBottom: 6 }}>
                  <Avatar name={r.name} size={32}/>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{r.name}</div>
                    <div className="row" style={{ gap: 8 }}>
                      <Stars value={r.rating}/>
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.when}</span>
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: 0 }}>{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

window.FORUMO_SCREENS_1 = { TopBar, HomeScreen, ListingsScreen, ListingDetailScreen, ListingCard };
