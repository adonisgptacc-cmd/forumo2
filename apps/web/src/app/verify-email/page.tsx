'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

import { ApiError } from '@forumo/shared';

import { createApiClient } from '../../lib/api-client';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');
  const pending = searchParams?.get('pending') === 'true';
  const prefillEmail = searchParams?.get('email') ?? '';

  type State = 'pending' | 'loading' | 'success' | 'error' | 'resending' | 'resent';
  const initialState: State = pending ? 'pending' : token ? 'loading' : 'error';
  const [state, setState] = useState<State>(initialState);
  const [resendEmail, setResendEmail] = useState(prefillEmail);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (pending || !token) return;

    const api = createApiClient();
    api.auth
      .verifyEmail(token)
      .then(() => setState('success'))
      .catch(() => setState('error'));
  }, [token, pending]);

  async function handleResend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResendError(null);
    setState('resending');
    try {
      const api = createApiClient();
      await api.auth.resendVerification(resendEmail);
      setState('resent');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to resend. Please try again.';
      setResendError(message);
      setState('error');
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-8">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Email verification</p>
        <h1 className="text-3xl font-semibold">Verify your email</h1>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-6 space-y-4">
        {state === 'pending' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-700 bg-amber-900/30">
                <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-medium text-white">Check your inbox</p>
                <p className="mt-1 text-sm text-slate-400">
                  We sent a verification link to{' '}
                  {resendEmail ? <span className="font-medium text-slate-200">{resendEmail}</span> : 'your email address'}.
                  Click the link to activate your account.
                </p>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <p className="text-xs text-slate-500 text-center">Didn&apos;t receive it?</p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setResendError(null);
                  setState('resending');
                  try {
                    const api = createApiClient();
                    await api.auth.resendVerification(resendEmail);
                    setState('resent');
                  } catch (err) {
                    const message = err instanceof ApiError ? err.message : 'Failed to resend. Please try again.';
                    setResendError(message);
                    setState('pending');
                  }
                }}
                className="space-y-2"
              >
                <input
                  type="email"
                  className="input w-full"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
                {resendError ? <p className="text-sm text-red-300">{resendError}</p> : null}
                <button
                  type="submit"
                  className="w-full rounded-md bg-amber-400 px-4 py-2 font-semibold text-slate-900 hover:bg-amber-300"
                >
                  Resend verification email
                </button>
              </form>
            </div>
          </div>
        )}

        {state === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />
            <p className="text-sm text-slate-400">Verifying your email address…</p>
          </div>
        )}

        {state === 'success' && (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-700 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-300">
              Your email has been verified successfully. You can now sign in.
            </div>
            <button
              type="button"
              onClick={() => router.push('/login' as any)}
              className="w-full rounded-md bg-amber-400 px-4 py-2 font-semibold text-slate-900 hover:bg-amber-300"
            >
              Sign in to your account
            </button>
          </div>
        )}

        {(state === 'error' || state === 'resending') && (
          <div className="space-y-4">
            <div className="rounded-md border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
              Link expired or invalid. Enter your email to receive a new verification link.
            </div>
            <form onSubmit={handleResend} className="space-y-3">
              <label className="space-y-2 text-sm">
                <span className="text-slate-300">Email address</span>
                <input
                  type="email"
                  className="input"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
              {resendError ? <p className="text-sm text-red-300">{resendError}</p> : null}
              <button
                type="submit"
                disabled={state === 'resending'}
                className="w-full rounded-md bg-amber-400 px-4 py-2 font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
              >
                {state === 'resending' ? 'Sending…' : 'Resend verification email'}
              </button>
            </form>
          </div>
        )}

        {state === 'resent' && (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-700 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-300">
              Verification email sent. Check your inbox and follow the link.
            </div>
            <button
              type="button"
              onClick={() => router.push('/login' as any)}
              className="w-full rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
