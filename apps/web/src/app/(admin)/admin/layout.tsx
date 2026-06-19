import Link from 'next/link';
import { ReactNode } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { SignOutButton } from '../../../components/signout-button';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { authOptions } from '../../../lib/auth';

const navItems = [
  { href: '/admin/users', label: 'Users', roles: ['ADMIN'] },
  { href: '/admin/kyc', label: 'KYC Queue', roles: ['ADMIN'] },
  { href: '/admin/moderations', label: 'Listing Moderation', roles: ['ADMIN', 'MODERATOR'] },
  { href: '/admin/disputes', label: 'Disputes', roles: ['ADMIN', 'MODERATOR'] },
  { href: '/admin/categories', label: 'Categories & Tags', roles: ['ADMIN'] },
  { href: '/admin/fees', label: 'Fee Schedules', roles: ['ADMIN'] },
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
    <div className="min-h-screen bg-[color:var(--bg)]">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[240px,1fr]">
        <aside className="card card-pad h-fit space-y-6">
          <div className="space-y-2">
            <p className="eyebrow">Admin console</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-semibold">{session.user?.name ?? 'Admin user'}</span>
              <span className="rounded-full border border-[color:var(--accent)] bg-[color:var(--accent-bg)] px-2 py-0.5 text-[10px] text-[color:var(--accent-2)]">
                {(session.user as any).role}
              </span>
            </div>
            <p className="text-xs muted">{session.user?.email}</p>
          </div>
          <div className="space-y-1 text-sm">
            {filteredNav.map((item) => (
              <Link
                key={item.href}
                className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2 subtle transition hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-bg)]"
                href={item.href as any}
              >
                <span>{item.label}</span>
                <span aria-hidden className="text-xs muted">→</span>
              </Link>
            ))}
          </div>
          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-2)] p-3 text-xs muted">
            <p className="font-semibold subtle">Security posture</p>
            <p className="mt-1">JWT session validated for privileged roles. Actions are recorded via the admin API.</p>
          </div>
          <SignOutButton />
        </aside>
        <section className="space-y-4 lg:space-y-6">
          <div className="card card-pad">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Control plane</p>
                <h1 className="h2">Staff operations</h1>
                <p className="text-sm muted mt-1">
                  Use the KYC queue, listing moderation, and dispute desks to keep the marketplace secure.
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Signed in with elevated privileges
              </div>
            </div>
          </div>
          <div className="card card-pad">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </section>
      </div>
    </div>
  );
}
