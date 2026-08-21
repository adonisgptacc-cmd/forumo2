"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function OrdersError({
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
          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
        />
      </svg>
      <h1 className="text-xl font-semibold text-slate-800">
        We couldn&apos;t load your orders
      </h1>
      <p className="text-sm text-slate-500 max-w-sm">
        There was a problem fetching your order history. Please try again or
        check back shortly.
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
          Dashboard
        </Link>
      </div>
    </div>
  );
}
