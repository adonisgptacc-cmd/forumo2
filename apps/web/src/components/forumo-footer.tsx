import Link from 'next/link';

export function ForumoFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)', padding: '48px 0 32px', marginTop: 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 40, marginBottom: 40 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 1, marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, fontStyle: 'italic', letterSpacing: '-0.04em', color: 'var(--ink)' }}>forumo</span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', marginBottom: 2, marginLeft: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.02em' }}>africa</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 280, lineHeight: 1.6 }}>
              A peer-to-peer marketplace where every order is held in escrow until you confirm receipt. Built for Lagos, Accra, Nairobi &amp; Johannesburg.
            </p>
          </div>

          <div>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Marketplace</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--ink-3)' }}>
              <Link href={'/listings' as any} style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Browse Listings</Link>
              <Link href={'/auctions' as any} style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Live Auctions</Link>
              <Link href={'/app/orders' as any} style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>My Orders</Link>
            </div>
          </div>

          <div>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Selling</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--ink-3)' }}>
              <Link href={'/app/listings/new' as any} style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Sell on Forumo</Link>
              <Link href={'/app/dashboard' as any} style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Seller Dashboard</Link>
              <Link href={'/app/kyc' as any} style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Seller Verification</Link>
            </div>
          </div>

          <div>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Trust &amp; Legal</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--ink-3)' }}>
              <Link href='/terms' style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Terms of Service</Link>
              <Link href='/privacy' style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Privacy Policy</Link>
              <a href="mailto:support@forumo.africa" style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Contact Support</a>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'var(--ink-3)' }}>
          <span>© {new Date().getFullYear()} Forumo Africa Ltd. All rights reserved.</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href='/terms' style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Terms</Link>
            <Link href='/privacy' style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Privacy</Link>
            <a href="mailto:legal@forumo.africa" style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Legal</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
