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
    <div className="min-h-screen bg-[color:var(--bg)] flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <p className="text-4xl font-bold text-red-600">!</p>
        <h2 className="text-xl font-semibold text-[color:var(--ink)]">Failed to load storefront</h2>
        <p className="text-sm text-[color:var(--ink-3)]">
          Something went wrong while loading this shop. Please try again.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <Link href="/listings" className="btn btn-ghost">
            Browse listings
          </Link>
        </div>
      </div>
    </div>
  );
}
