'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <p className="text-4xl font-bold text-red-400">!</p>
        <h2 className="text-xl font-semibold text-white">Failed to load storefront</h2>
        <p className="text-sm text-slate-400">
          Something went wrong while loading this shop. Please try again.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Try again
          </button>
          <Link href="/listings" className="rounded-lg border border-slate-700 px-5 py-2 text-sm text-slate-300 hover:bg-slate-800">
            Browse listings
          </Link>
        </div>
      </div>
    </div>
  );
}
