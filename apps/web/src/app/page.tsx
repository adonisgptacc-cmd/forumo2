import Link from 'next/link';

const modules = [
  {
    title: 'Escrow & Orders',
    body: 'Secure payments powered by Stripe + Trustap integrations with dispute workflows and automated release timers.',
  },
  {
    title: 'Auctions',
    body: 'Real-time bidding, proxy logic, and AI-powered anti-sniping keep the experience fair for every participant.',
  },
  {
    title: 'Messaging',
    body: 'Socket.IO chat with photo uploads, moderation flags, and delivery receipts for high-trust coordination.',
  },
  {
    title: 'Inventory',
    body: 'Multi-location stock, reservations, bundles, and damage logging feed into the seller analytics dashboard.',
  },
  {
    title: 'AI Moderation',
    body: 'Language + vision models score listings, chats, and bids so humans only review the risky edge cases.',
  },
  {
    title: 'Admin Console',
    body: 'KYC, disputes, payouts, and audit trails unified inside a modern Next.js dashboard for staff and moderators.',
  },
];

const pipelinePriorities = [
  {
    title: 'Database wiring',
    body: 'Prisma models are being locked to PostgreSQL + Redis so the API gateway can hydrate listings, chats, and bids without manual overrides.',
  },
  {
    title: 'MVP endpoints',
    body: 'Auth, Listings, Orders, and Messaging routes are being finished in NestJS so every client—web, mobile, admin—can hit the same contract.',
  },
  {
    title: 'Real-time auctions + escrow',
    body: 'Socket.IO bidding paired with Trustap + Stripe escrow keeps payments, release timers, and dispute states synchronized for launch markets.',
  },
];

export default function HomePage() {
  return (
    <main className="space-y-12">
      <section className="space-y-4">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Forumo · Pan-African Marketplace</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">Safety-first commerce built for local communities.</h1>
        <p className="max-w-3xl text-lg text-slate-300">
          We are bootstrapping the codebase based on the 2025 PRD. Explore the modules launching in the MVP and the shared
          architecture powering every touchpoint.
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-slate-300">
          <span className="rounded-full border border-slate-700 px-4 py-1">NestJS API</span>
          <span className="rounded-full border border-slate-700 px-4 py-1">Next.js Web</span>
          <span className="rounded-full border border-slate-700 px-4 py-1">React Native</span>
          <span className="rounded-full border border-slate-700 px-4 py-1">AI Moderation</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-amber-400 px-4 py-2 text-sm text-amber-200"
            href="/listings"
          >
            Browse sample listings →
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-amber-300"
            href="/listings/new"
          >
            Launch a new listing
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {modules.map((module) => (
          <article key={module.title} className="grid-card space-y-3">
            <h3 className="text-xl">{module.title}</h3>
            <p className="text-slate-300">{module.body}</p>
          </article>
        ))}
      </section>

      <section className="grid-card space-y-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Pipeline Reminders</p>
          <h2 className="text-2xl">Same priorities across the org</h2>
          <p className="text-slate-300">
            Product, engineering, and marketing are aligned on the current sprint: wiring the databases, finishing the MVP
            endpoints, and shipping the real-time auctions + escrow combo that anchors V1 revenue.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {pipelinePriorities.map((priority) => (
            <article key={priority.title} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <h3 className="text-lg">{priority.title}</h3>
              <p className="text-sm text-slate-400">{priority.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid-card space-y-4">
        <h2 className="text-2xl">Next steps</h2>
        <ol className="list-decimal space-y-2 pl-5 text-slate-300">
          <li>Connect the API gateway to PostgreSQL + Redis via Prisma.</li>
          <li>Implement Auth, Listings, Orders, Messaging MVP endpoints.</li>
          <li>Ship real-time auctions and escrow flows for V1.</li>
        </ol>
      </section>
    </main>
  );
}
