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
      <p className="text-5xl font-bold text-red-500">!</p>
      <h1 className="h2">Admin Error</h1>
      <p className="text-sm muted max-w-sm">
        An unexpected error occurred in the admin panel. Check the console for details.
      </p>
      {error.digest && (
        <p className="text-xs muted font-mono">Ref: {error.digest}</p>
      )}
      <div className="flex gap-3 pt-2">
        <button
          onClick={reset}
          className="btn btn-primary btn-sm"
        >
          Try again
        </button>
        <Link
          href={'/admin' as any}
          className="btn btn-ghost btn-sm"
        >
          Admin home
        </Link>
      </div>
    </div>
  );
}
