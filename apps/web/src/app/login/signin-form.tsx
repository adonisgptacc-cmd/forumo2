"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@forumo/shared";

import { createApiClient } from "../../lib/api-client";
import { getApiBaseUrl } from "@forumo/shared";
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
  const [magicSent, setMagicSent] = useState(false);
  const resetSuccess = searchParams?.get("reset") === "success";

  async function handleMagicLink() {
    setError(null);
    setMagicSent(false);
    if (!identifier.trim()) {
      setError("Enter your email or phone first");
      return;
    }
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      if (!res.ok) throw new Error("Unable to send magic link");
      setMagicSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send magic link",
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const id = identifier.trim();
      const payload: Record<string, string> = { password };
      if (id.includes("@")) payload.email = id;
      else if (id.startsWith("+")) payload.phone = id;
      else payload.identifier = id;
      const result = await api.auth.login(payload as never);

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
          placeholder="you@example.com or +1234567890"
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
      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[color:var(--line)]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[color:var(--surface)] px-2 muted">or</span>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-block border border-slate-300 bg-white"
        onClick={handleMagicLink}
        disabled={!identifier.trim()}
      >
        Send magic link to email
      </button>
      {magicSent ? (
        <p className="text-sm text-emerald-600">
          If an account exists, a magic link has been sent. Check your email.
        </p>
      ) : null}
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
