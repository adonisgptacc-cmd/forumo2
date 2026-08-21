"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function MessagesError({
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
          d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
        />
      </svg>
      <h1 className="text-xl font-semibold text-slate-800">
        Messages couldn&apos;t load
      </h1>
      <p className="text-sm text-slate-500 max-w-sm">
        There was a problem loading your conversations. Your messages are safe —
        try again in a moment.
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
