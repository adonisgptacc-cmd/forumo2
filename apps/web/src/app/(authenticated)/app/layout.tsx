import { ReactNode } from 'react';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { SignOutButton } from '../../../components/signout-button';
import { NotificationNavLink } from '../../../components/notification-badge';
import { MessagesNavLink } from '../../../components/messages-nav-link';
import { authOptions } from '../../../lib/auth';

const navItems = [
  { href: '/app', label: 'Overview' },
  { href: '/app/dashboard', label: 'Seller Dashboard' },
  { href: '/app/listings', label: 'My Listings' },
  { href: '/app/storefront', label: 'Storefront' },
  { href: '/app/auctions/new', label: 'Create Auction' },
  { href: '/app/orders', label: 'Orders' },
  { href: '/app/returns', label: 'Returns' },
  { href: '/app/disputes', label: 'Disputes' },
  { href: '/app/offers', label: 'Offers' },
  { href: '/app/wishlist', label: 'Wishlist' },
  { href: '/app/inventory', label: 'Inventory' },
  { href: '/app/cart', label: 'Cart' },
  { href: '/app/dashboard/analytics', label: 'Analytics' },
  { href: '/app/reviews', label: 'My Reviews' },
  { href: '/app/profile', label: 'Profile' },
  { href: '/app/kyc', label: 'Verification' },
  { href: '/app/settings/account', label: 'Account Settings' },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login?callbackUrl=/app');
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Secure workspace</p>
            <h1 className="text-xl sm:text-2xl font-semibold truncate">{session.user?.name ?? 'Unnamed Seller'}</h1>
            <p className="text-sm text-slate-400 truncate">{session.user?.email}</p>
          </div>
          <SignOutButton />
        </div>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-amber-400 min-h-[36px] flex items-center"
              href={item.href as any}
            >
              {item.label}
            </Link>
          ))}
          <MessagesNavLink />
          <NotificationNavLink />
        </nav>
      </header>
      <section>{children}</section>
    </div>
  );
}
