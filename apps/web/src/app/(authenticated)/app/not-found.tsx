import Link from 'next/link';

export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center space-y-4 px-4">
      <p className="text-6xl font-bold text-amber-400">404</p>
      <h1 className="text-xl font-semibold text-white">Page not found</h1>
      <p className="text-sm text-slate-400 max-w-sm">
        This page doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <div className="flex gap-3 pt-2">
        <Link
          href="/app"
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
        >
          Go to dashboard
        </Link>
        <Link
          href="/app/orders"
          className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          My orders
        </Link>
      </div>
    </div>
  );
}
