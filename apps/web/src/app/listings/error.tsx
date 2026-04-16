'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ListingsError({
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
    <div className="px-4 py-16 text-center space-y-4">
      <p className="text-4xl font-bold text-red-500">!</p>
      <h2 className="text-xl font-semibold">Failed to load listings</h2>
      <p className="text-sm text-slate-500">
        Something went wrong while fetching listings. Please try again.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <button
          onClick={reset}
          className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400"
        >
          Try again
        </button>
        <Link href="/" className="rounded-lg border border-slate-300 px-5 py-2 text-sm text-slate-600 hover:bg-slate-100">
          Go home
        </Link>
      </div>
    </div>
  );
}
