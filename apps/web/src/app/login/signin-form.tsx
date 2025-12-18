'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ApiError, type AuthResponse } from '@forumo/shared';

import { createApiClient } from '../../lib/api-client';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') ?? '/app';
  const api = createApiClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
      <label className="space-y-2 text-sm">
        <span className="text-slate-300">Email</span>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </label>
      <label className="space-y-2 text-sm">
        <span className="text-slate-300">Password</span>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          required
        />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button
        type="submit"
        className="w-full rounded-md bg-amber-400 px-4 py-2 font-semibold text-slate-900 hover:bg-amber-300"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-xs text-slate-500">
        Need an account? <a className="text-amber-300" href="/signup">Create one</a> to unlock dashboards.
      </p>
    </form>
  );
}
