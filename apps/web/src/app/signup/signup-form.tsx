'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ApiError, type AuthResponse } from '@forumo/shared';

import { createApiClient } from '../../lib/api-client';

export function SignupForm() {
  const router = useRouter();
  const api = createApiClient();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const persistAuth = useCallback((auth: AuthResponse) => {
    try {
      localStorage.setItem('forumo.accessToken', auth.accessToken);
      localStorage.setItem('forumo.user', JSON.stringify(auth.user));
    } catch {
      // ignore write errors (e.g., Safari private mode)
    }
  }, []);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const auth = await api.auth.register(form);
      persistAuth(auth);
      setMessage('Account created. Redirecting you to the dashboard…');
      const signInResult = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (signInResult?.error) {
        throw new Error(signInResult.error);
      }
      router.push('/app');
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
      setError(apiErrorMessage || genericMessage || 'Unable to create account. Try a different email.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-slate-300">Full name</span>
          <input className="input" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-300">Phone</span>
          <input className="input" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
        </label>
      </div>
      <label className="space-y-1 text-sm">
        <span className="text-slate-300">Email</span>
        <input
          type="email"
          className="input"
          value={form.email}
          onChange={(event) => updateField('email', event.target.value)}
          required
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="text-slate-300">Password</span>
        <input
          type="password"
          className="input"
          value={form.password}
          onChange={(event) => updateField('password', event.target.value)}
          required
        />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      <button
        type="submit"
        className="w-full rounded-md bg-emerald-400 px-4 py-2 font-semibold text-slate-900 hover:bg-emerald-300"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
