"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    import("@sentry/nextjs")
      .then(({ captureException }) => captureException(error))
      .catch(() => undefined);
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
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
        />
      </svg>
      <h1 className="text-xl font-semibold text-slate-800">
        Dashboard is temporarily unavailable
      </h1>
      <p className="text-sm text-slate-500 max-w-sm">
        We couldn&apos;t load your seller dashboard. Your data is safe — please
        try again.
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400 font-mono">Ref: {error.digest}</p>
      )}
      <div className="flex gap-3 pt-1">
        <button onClick={reset} className="btn btn-primary btn-sm">
          Try again
        </button>
        <Link
          href={"/app" as any}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
