"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ApiError } from "@forumo/shared";
import { createApiClient } from "../../../lib/api-client";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-center text-xl tracking-widest focus:border-gray-500 focus:outline-none";

export function TwoFactorForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams?.get("mode") ?? "verify"; // 'verify' | 'setup'
  const isSetup = mode === "setup";

  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Setup-specific state
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [setupStep, setSetupStep] = useState<"qr" | "done">("qr");
  const [initError, setInitError] = useState<string | null>(null);

  const api = createApiClient();
  const initCalledRef = useRef(false);

  useEffect(() => {
    const token = sessionStorage.getItem("forumo-admin.2faToken");
    if (!token) {
      router.replace("/login");
      return;
    }
    setTwoFactorToken(token);

    if (isSetup && !initCalledRef.current) {
      initCalledRef.current = true;
      api.auth
        .setup2FAInit(token)
        .then(({ qrCode: qr, secret: s }) => {
          setQrCode(qr);
          setSecret(s);
        })
        .catch((err) =>
          setInitError(err instanceof ApiError ? err.message : "Failed to start 2FA setup."),
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSetup]);

  async function finishLogin(accessToken: string) {
    const result = await signIn("token-auth", { token: accessToken, redirect: false });
    if (!result?.ok) {
      throw new Error("Signed in, but this account does not have admin or moderator access.");
    }
    sessionStorage.removeItem("forumo-admin.2faToken");
    router.push("/users");
    router.refresh();
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!twoFactorToken) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const auth = await api.auth.verify2FA(twoFactorToken, code.replace(/\s/g, ""));
      await finishLogin(auth.accessToken);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Invalid code. Try again.",
      );
      setCode("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSetupVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!twoFactorToken) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await api.auth.setup2FAVerify(twoFactorToken, code.replace(/\s/g, ""));
      setBackupCodes(result.backupCodes);
      setSetupStep("done");
      await finishLogin(result.accessToken);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Invalid code. Try again.",
      );
      setCode("");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinue() {
    sessionStorage.removeItem("forumo-admin.2faToken");
    router.push("/users");
    router.refresh();
  }

  // ── Verify existing 2FA ─────────────────────────────────────────────────
  if (!isSetup) {
    return (
      <form
        onSubmit={handleVerify}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold text-gray-900">Two-factor authentication</h1>
          <p className="text-sm text-gray-500">Enter the 6-digit code from your authenticator app.</p>
        </div>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          className={inputCls}
          placeholder="000 000"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          autoFocus
          required
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          disabled={isSubmitting || code.replace(/\s/g, "").length < 6}
        >
          {isSubmitting ? "Verifying…" : "Verify"}
        </button>
      </form>
    );
  }

  // ── Setup: show backup codes after verification ─────────────────────────
  if (setupStep === "done" && backupCodes) {
    return (
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold text-gray-900">Save your backup codes</h1>
          <p className="text-sm text-gray-500">
            Store these somewhere safe. Each code can only be used once if you lose your phone.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-sm">
          {backupCodes.map((c) => (
            <span key={c} className="text-center">
              {c}
            </span>
          ))}
        </div>
        <button
          onClick={handleContinue}
          className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          I&apos;ve saved them — Continue
        </button>
      </div>
    );
  }

  // ── Setup: QR code scan + first code verification ───────────────────────
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="space-y-1 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Set up two-factor authentication</h1>
        <p className="text-sm text-gray-500">
          Scan this QR code with Google Authenticator, Authy, or any TOTP app.
        </p>
      </div>

      {initError ? (
        <p className="text-sm text-red-600">{initError}</p>
      ) : qrCode ? (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCode}
            alt="2FA QR code"
            width={200}
            height={200}
            className="rounded-md border border-gray-200"
          />
        </div>
      ) : (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
        </div>
      )}

      {secret ? (
        <p className="text-center text-xs text-gray-500">
          Can&apos;t scan?{" "}
          <span className="break-all font-mono font-medium text-gray-900">{secret}</span>
        </p>
      ) : null}

      <form onSubmit={handleSetupVerify} className="space-y-3">
        <label className="space-y-2 text-sm">
          <span className="text-gray-700">Enter the 6-digit code to confirm setup</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            className={inputCls}
            placeholder="000 000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          disabled={isSubmitting || !qrCode || code.replace(/\s/g, "").length < 6}
        >
          {isSubmitting ? "Verifying…" : "Activate 2FA"}
        </button>
      </form>
    </div>
  );
}
