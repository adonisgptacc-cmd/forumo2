import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account Suspended — Forumo',
};

export default async function AccountSuspendedPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string; code?: string }>;
}) {
  const resolved = await searchParams;
  const isBanned = resolved?.code === 'ACCOUNT_BANNED';
  const reason = resolved?.reason;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">
            {isBanned ? 'Account Banned' : 'Account Suspended'}
          </h1>
          <p className="text-slate-600">
            {isBanned
              ? 'Your account has been permanently banned from Forumo due to violations of our Terms of Service.'
              : 'Your account has been temporarily suspended. You cannot access the marketplace at this time.'}
          </p>
          {reason && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 text-left mt-3">
              <span className="font-medium">Reason: </span>
              {reason}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 text-left">
          <h2 className="font-semibold text-slate-800">What can you do?</h2>
          <ul className="text-sm text-slate-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">→</span>
              Review our{' '}
              <Link href="/terms" className="text-amber-600 hover:underline">
                Terms of Service
              </Link>{' '}
              to understand our policies.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">→</span>
              Contact our support team to get more information or appeal this decision.
            </li>
            {!isBanned && (
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">→</span>
                Submit an appeal if you believe this was a mistake.
              </li>
            )}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="mailto:support@forumo.com"
            className="btn btn-primary"
          >
            Contact support
          </a>
          {!isBanned && (
            <a
              href="mailto:appeals@forumo.com?subject=Account+Suspension+Appeal"
              className="btn btn-ghost"
            >
              Submit an appeal
            </a>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Reference: {isBanned ? 'BAN' : 'SUSP'}-
          {Date.now().toString(36).toUpperCase()}
        </p>
      </div>
    </div>
  );
}
