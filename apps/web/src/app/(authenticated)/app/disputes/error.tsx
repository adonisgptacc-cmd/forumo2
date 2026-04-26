'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function DisputesError({
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
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center space-y-4 px-4">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-12 w-12 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <h1 className="text-xl font-semibold text-slate-800">Disputes couldn&apos;t load</h1>
      <p className="text-sm text-slate-500 max-w-sm">
        There was a problem loading dispute information. Please try again or contact support if this persists.
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400 font-mono">Ref: {error.digest}</p>
      )}
      <div className="flex gap-3 pt-1">
        <button
          onClick={reset}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
        >
          Try again
        </button>
        <Link
          href={'/app/orders' as any}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          My orders
        </Link>
      </div>
    </div>
  );
}
