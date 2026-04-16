'use client';

import Link from 'next/link';
import { useState } from 'react';

import { createApiClient } from '../../lib/api-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const api = createApiClient();
      await api.auth.requestPasswordReset({ email });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold">Check your inbox</h1>
          <p className="text-sm text-slate-400">
            If an account exists for <span className="text-amber-300">{email}</span>, we sent a
            reset code. It expires in 10 minutes.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-6 space-y-4">
          <p className="text-sm text-slate-300">Enter the code along with your new password:</p>
          <Link
            href={`/reset-password?email=${encodeURIComponent(email)}`}
            className="block w-full rounded-md bg-amber-400 px-4 py-2 text-center font-semibold text-slate-900 hover:bg-amber-300"
          >
            Enter reset code
          </Link>
          <p className="text-center text-xs text-slate-500">
            Didn&apos;t receive it?{' '}
            <button
              className="text-amber-300 hover:underline"
              onClick={() => setSubmitted(false)}
            >
              Try again
            </button>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-8">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Account recovery</p>
        <h1 className="text-3xl font-semibold">Forgot your password?</h1>
        <p className="text-sm text-slate-400">
          Enter your email and we&apos;ll send a one-time reset code.
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-6"
      >
        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Email address</span>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button
          type="submit"
          className="w-full rounded-md bg-amber-400 px-4 py-2 font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending…' : 'Send reset code'}
        </button>
        <p className="text-center text-xs text-slate-500">
          Remember it?{' '}
          <Link className="text-amber-300" href="/login">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
