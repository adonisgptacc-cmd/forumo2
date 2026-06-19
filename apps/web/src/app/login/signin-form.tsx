'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ApiError, type AuthResponse } from '@forumo/shared';

import { createApiClient } from '../../lib/api-client';
import { GoogleSignInButton } from '../../components/google-signin-button';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') ?? '/app';
  const api = createApiClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resetSuccess = searchParams?.get('reset') === 'success';

  const persistAuth = useCallback((auth: AuthResponse) => {
    try {
      localStorage.setItem('forumo.accessToken', auth.accessToken);
      localStorage.setItem('forumo.user', JSON.stringify(auth.user));
    } catch {
      // ignore write errors (e.g., Safari private mode)
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const auth = await api.auth.login({ email, password });
      persistAuth(auth);
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      if (!result?.ok && !result?.url) {
        throw new Error('Authentication failed. Please try again.');
      }
      router.push((result?.url ?? callbackUrl) as any);
      router.refresh();
    } catch (err) {
      try {
        localStorage.removeItem('forumo.accessToken');
        localStorage.removeItem('forumo.user');
      } catch {
        // ignore storage errors
      }
      const apiErrorMessage = err instanceof ApiError ? err.message : null;
      const genericMessage = err instanceof Error ? err.message : null;
      setError(apiErrorMessage || genericMessage || 'Unable to sign in. Double-check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 card card-pad">
      {resetSuccess ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-[color:var(--escrow)]">
          Password reset successfully. Sign in with your new password.
        </p>
      ) : null}
      <label className="space-y-2 text-sm">
        <span className="subtle">Email</span>
        <input
          type="email"
          className="input-forumo"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </label>
      <label className="space-y-2 text-sm">
        <span className="subtle">Password</span>
        <input
          type="password"
          className="input-forumo"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          required
        />
      </label>
      <div className="flex justify-end">
        <Link className="text-xs text-[color:var(--accent)] hover:underline" href="/forgot-password">
          Forgot password?
        </Link>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[color:var(--line)]" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-[color:var(--surface)] px-2 muted">or</span></div>
      </div>
      <GoogleSignInButton />
      <p className="text-center text-xs muted">
        Need an account? <a className="text-[color:var(--accent)]" href="/signup">Create one</a> to unlock dashboards.
      </p>
    </form>
  );
}
