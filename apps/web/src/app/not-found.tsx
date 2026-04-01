import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <p className="text-7xl font-bold text-amber-400">404</p>
        <h1 className="text-2xl font-semibold text-white">Page not found</h1>
        <p className="text-sm text-slate-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            href="/"
            className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Go home
          </Link>
          <Link
            href="/listings"
            className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Browse listings
          </Link>
        </div>
      </div>
    </div>
  );
}
