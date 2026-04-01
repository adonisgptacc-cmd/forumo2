'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // Report to Sentry if configured
    import('@sentry/nextjs').then(({ captureException }) => captureException(error)).catch(() => undefined);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <p className="text-5xl font-bold text-red-400">500</p>
        <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
        <p className="text-sm text-slate-400">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-600 font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
