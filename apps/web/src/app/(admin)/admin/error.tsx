'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    import('@sentry/nextjs').then(({ captureException }) => captureException(error)).catch(() => undefined);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center space-y-4 px-4">
      <p className="text-5xl font-bold text-red-400">!</p>
      <h1 className="text-xl font-semibold text-white">Admin Error</h1>
      <p className="text-sm text-slate-400 max-w-sm">
        An unexpected error occurred in the admin panel. Check the console for details.
      </p>
      {error.digest && (
        <p className="text-xs text-slate-600 font-mono">Ref: {error.digest}</p>
      )}
      <div className="flex gap-3 pt-2">
        <button
          onClick={reset}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
        >
          Try again
        </button>
        <Link
          href={'/admin' as any}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Admin home
        </Link>
      </div>
    </div>
  );
}
