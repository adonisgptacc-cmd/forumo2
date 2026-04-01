import Link from 'next/link';

export function ForumoFooter() {
  return (
    <footer className="border-t border-slate-200 bg-[#131921] text-slate-400 mt-12">
      <div className="mx-auto max-w-[1500px] px-4 py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Get to Know Us</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-amber-400 transition-colors">About Forumo</Link></li>
              <li><Link href="/blog" className="hover:text-amber-400 transition-colors">Blog</Link></li>
              <li><Link href="/careers" className="hover:text-amber-400 transition-colors">Careers</Link></li>
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Buying</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/listings" className="hover:text-amber-400 transition-colors">Browse Listings</Link></li>
              <li><Link href="/auctions" className="hover:text-amber-400 transition-colors">Live Auctions</Link></li>
              <li><Link href="/app/orders" className="hover:text-amber-400 transition-colors">My Orders</Link></li>
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Selling</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/listings/new" className="hover:text-amber-400 transition-colors">Sell on Forumo</Link></li>
              <li><Link href="/app/dashboard" className="hover:text-amber-400 transition-colors">Seller Dashboard</Link></li>
              <li><Link href="/app/kyc" className="hover:text-amber-400 transition-colors">Seller Verification</Link></li>
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Help & Legal</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/terms" className="hover:text-amber-400 transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</Link></li>
              <li><a href="mailto:support@forumo.africa" className="hover:text-amber-400 transition-colors">Contact Support</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-slate-700 pt-6 flex flex-col items-center gap-2 text-xs text-slate-500 md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} Forumo Africa Ltd. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-amber-400 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-amber-400 transition-colors">Privacy</Link>
            <a href="mailto:legal@forumo.africa" className="hover:text-amber-400 transition-colors">Legal</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
