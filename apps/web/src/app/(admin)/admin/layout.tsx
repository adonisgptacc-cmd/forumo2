import Link from 'next/link';
import { ReactNode } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { SignOutButton } from '../../../components/signout-button';
import { authOptions } from '../../../lib/auth';

const navItems = [
  { href: '/admin/kyc', label: 'KYC Queue', roles: ['ADMIN'] },
  { href: '/admin/moderations', label: 'Listing Moderation', roles: ['ADMIN', 'MODERATOR'] },
  { href: '/admin/disputes', label: 'Disputes', roles: ['ADMIN', 'MODERATOR'] },
];

const allowedRoles = ['ADMIN', 'MODERATOR'];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin');
  }

  if (!allowedRoles.includes((session.user as any).role)) {
    redirect('/unauthorized');
  }

  const filteredNav = navItems.filter((item) => item.roles.includes((session.user as any).role));

  return (
    <div className="admin-shell text-slate-100">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[240px,1fr]">
        <aside className="admin-surface h-fit space-y-6 p-6">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Admin console</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{session.user?.name ?? 'Admin user'}</span>
              <span className="rounded-full border border-amber-300/60 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-100">
                {(session.user as any).role}
              </span>
            </div>
            <p className="text-xs text-slate-400">{session.user?.email}</p>
          </div>
          <div className="space-y-1 text-sm">
            {filteredNav.map((item) => (
              <Link
                key={item.href}
                className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2 text-slate-200 transition hover:border-amber-400 hover:bg-amber-400/5"
                href={item.href}
              >
                <span>{item.label}</span>
                <span aria-hidden className="text-xs text-slate-500">
                  →
                </span>
              </Link>
            ))}
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-400">
            <p className="font-semibold text-slate-200">Security posture</p>
            <p className="mt-1">JWT session validated for privileged roles. Actions are recorded via the admin API.</p>
          </div>
          <SignOutButton />
        </aside>
        <section className="space-y-4 lg:space-y-6">
          <div className="admin-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Control plane</p>
                <h1 className="text-2xl font-semibold text-white">Staff operations</h1>
                <p className="text-sm text-slate-400">
                  Use the KYC queue, listing moderation, and dispute desks to keep the marketplace secure.
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                Signed in with elevated privileges
              </div>
            </div>
          </div>
          <div className="admin-surface p-6">{children}</div>
        </section>
      </div>
    </div>
  );
}
