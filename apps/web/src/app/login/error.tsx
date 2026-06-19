'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function LoginError({
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
    <div className="flex min-h-screen flex-col items-center justify-center text-center space-y-4 px-4">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-12 w-12 text-[color:var(--ink-3)]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
      <h1 className="text-xl font-semibold text-[color:var(--ink)]">Sign-in encountered a problem</h1>
      <p className="text-sm text-[color:var(--ink-3)] max-w-sm">
        Something went wrong during the sign-in process. Please try again.
      </p>
      <div className="flex gap-3 pt-1">
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
