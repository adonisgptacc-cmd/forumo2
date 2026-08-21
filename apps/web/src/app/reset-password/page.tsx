"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { createApiClient } from "../../lib/api-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams?.get("email") ?? "";

  const [email, setEmail] = useState(prefillEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setIsSubmitting(true);
    try {
      const api = createApiClient();
      await api.auth.confirmPasswordReset({ email, code, newPassword });
      router.push("/login?reset=success");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid or expired code. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 card card-pad">
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
      <label className="space-y-2 text-sm">
        <span className="subtle">Reset code</span>
        <input
          type="text"
          className="input-forumo tracking-widest"
          value={code}
          onChange={(e) => setCode(e.target.value.trim())}
          placeholder="6-digit code"
          maxLength={8}
          required
        />
      </label>
      <label className="space-y-2 text-sm">
        <span className="subtle">New password</span>
        <input
          type="password"
          className="input-forumo"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
          minLength={8}
          required
        />
      </label>
      <label className="space-y-2 text-sm">
        <span className="subtle">Confirm new password</span>
        <input
          type="password"
          className="input-forumo"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat new password"
          required
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        className="w-full rounded-md bg-[color:var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[color:var(--accent-2)] disabled:opacity-50"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Resetting…" : "Reset password"}
      </button>
      <p className="text-center text-xs muted">
        Need a new code?{" "}
        <Link className="text-[color:var(--accent)]" href="/forgot-password">
          Request another
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-md space-y-8">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
          Account recovery
        </p>
        <h1 className="text-3xl font-semibold">Set a new password</h1>
        <p className="text-sm muted">
          Enter the code we sent to your email along with your new password.
        </p>
      </div>
      <Suspense
        fallback={<div className="card card-pad muted text-sm">Loading…</div>}
      >
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
