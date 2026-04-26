import Link from 'next/link';
import { redirect } from 'next/navigation';

export default function NotFound() {
  async function search(formData: FormData) {
    'use server';
    const q = (formData.get('q') as string | null)?.trim();
    if (q) redirect(`/listings?keyword=${encodeURIComponent(q)}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-md w-full">
        <p className="text-7xl font-bold text-amber-400">404</p>
        <h1 className="text-2xl font-semibold text-white">Page not found</h1>
        <p className="text-sm text-slate-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <form action={search} className="flex gap-2 mt-2">
          <input
            name="q"
            type="text"
            placeholder="Search the marketplace…"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 whitespace-nowrap"
          >
            Search
          </button>
        </form>

        <div className="flex justify-center gap-3 pt-1">
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
