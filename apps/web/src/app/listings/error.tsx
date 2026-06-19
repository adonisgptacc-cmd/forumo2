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
      <p className="text-4xl font-bold text-red-600">!</p>
      <h2 className="text-xl font-semibold text-[color:var(--ink)]">Failed to load listings</h2>
      <p className="text-sm text-[color:var(--ink-3)]">
        Something went wrong while fetching listings. Please try again.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <button onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-ghost">
          Go home
        </Link>
      </div>
    </div>
  );
}
