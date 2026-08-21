"use client";

import { useEffect } from "react";
import Link from "next/link";

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
    import("@sentry/nextjs")
      .then(({ captureException }) => captureException(error))
      .catch(() => undefined);
  }, [error]);

  return (
    <div className="min-h-screen bg-[color:var(--bg)] flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <p className="text-5xl font-bold text-red-600">500</p>
        <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
          Something went wrong
        </h1>
        <p className="text-sm text-[color:var(--ink-3)]">
          An unexpected error occurred. Please try again or contact support if
          the problem persists.
        </p>
        {error.digest && (
          <p className="text-xs text-[color:var(--ink-3)] font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
