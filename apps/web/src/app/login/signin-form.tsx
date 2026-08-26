"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@forumo/shared";

import { createApiClient } from "../../lib/api-client";
import { set2FaToken } from "../../lib/2fa-store";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") ?? "/app";
  const api = createApiClient();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resetSuccess = searchParams?.get("reset") === "success";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await api.auth.login({ identifier, password });

      // ── OAuth-account recovery gate ──────────────────────────────────────
      if ("passwordSetupRequired" in result) {
        router.push(
          (`/login/recover-account?token=${encodeURIComponent(
            result.recoveryToken,
          )}&email=${encodeURIComponent(identifier)}`) as any,
        );
        return;
      }

      // ── 2FA gate ────────────────────────────────────────────────────────
      if ("twoFactorToken" in result) {
        set2FaToken(result.twoFactorToken, callbackUrl);

        if ("twoFactorSetupRequired" in result) {
          router.push("/login/2fa?mode=setup" as any);
        } else {
          router.push("/login/2fa?mode=verify" as any);
        }
        return;
      }

      // ── Full auth response (should not happen if 2FA is mandatory) ──────
      const nextAuthResult = await signIn("token-auth", {
        token: result.accessToken,
        redirect: false,
        callbackUrl,
      });
      if (nextAuthResult?.error) throw new Error(nextAuthResult.error);
      router.push((nextAuthResult?.url ?? callbackUrl) as any);
      router.refresh();
    } catch (err) {
      const apiErrorMessage = err instanceof ApiError ? err.message : null;
      const genericMessage = err instanceof Error ? err.message : null;
      setError(
        apiErrorMessage ||
          genericMessage ||
          "Unable to sign in. Double-check your credentials.",
      );
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
        <span className="subtle">Email or phone</span>
        <input
          type="text"
          className="input-forumo"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="you@example.com or +27821234567"
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
        <Link
          className="text-xs text-[color:var(--accent)] hover:underline"
          href="/forgot-password"
        >
          Forgot password?
        </Link>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-xs muted">
        Need an account?{" "}
        <a className="text-[color:var(--accent)]" href="/signup">
          Create one
        </a>{" "}
        to unlock dashboards.
      </p>
    </form>
  );
}
