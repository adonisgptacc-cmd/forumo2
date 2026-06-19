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
          <p className="text-sm muted">
            If an account exists for <span className="text-[color:var(--accent)]">{email}</span>, we sent a
            reset code. It expires in 10 minutes.
          </p>
        </div>
        <div className="card card-pad space-y-4">
          <p className="text-sm text-[color:var(--ink-2)]">Enter the code along with your new password:</p>
          <Link
            href={`/reset-password?email=${encodeURIComponent(email)}`}
            className="block w-full rounded-md bg-[color:var(--accent)] px-4 py-2 text-center font-semibold text-white hover:bg-[color:var(--accent-2)]"
          >
            Enter reset code
          </Link>
          <p className="text-center text-xs muted">
            Didn&apos;t receive it?{' '}
            <button
              className="text-[color:var(--accent)] hover:underline"
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
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-3)]">Account recovery</p>
        <h1 className="text-3xl font-semibold">Forgot your password?</h1>
        <p className="text-sm muted">
          Enter your email and we&apos;ll send a one-time reset code.
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 card card-pad"
      >
        <label className="space-y-2 text-sm">
          <span className="subtle">Email address</span>
          <input
            type="email"
            className="input-forumo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          className="w-full rounded-md bg-[color:var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[color:var(--accent-2)] disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending…' : 'Send reset code'}
        </button>
        <p className="text-center text-xs muted">
          Remember it?{' '}
          <Link className="text-[color:var(--accent)]" href="/login">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
