import { ReactNode } from 'react';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { SignOutButton } from '../../../components/signout-button';
import { authOptions } from '../../../lib/auth';

const navItems = [
  { href: '/app', label: 'Overview' },
  { href: '/app/orders', label: 'Orders & Escrow' },
  { href: '/app/checkout', label: 'Buyer Checkout' },
  { href: '/app/messages', label: 'Messaging' },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login?callbackUrl=/app');
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Secure workspace</p>
            <h1 className="text-2xl font-semibold">{session.user?.name ?? 'Unnamed Seller'}</h1>
            <p className="text-sm text-slate-400">{session.user?.email}</p>
          </div>
          <SignOutButton />
        </div>
        <nav className="mt-4 flex flex-wrap gap-3 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className="rounded-full border border-slate-700 px-4 py-1 text-slate-300 hover:border-amber-400"
              href={item.href as any}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <section>{children}</section>
    </div>
  );
}
