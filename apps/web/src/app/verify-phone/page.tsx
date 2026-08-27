"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

import { ApiError } from "@forumo/shared";

import { createApiClient } from "../../lib/api-client";

// A stable-per-visit identifier for the OTP device-session bookkeeping the
// backend does on this endpoint. Not used to bind PHONE_VERIFICATION codes
// to a device (verifyOtp() deliberately doesn't filter on it for this
// purpose — see auth.service.ts), just satisfies VerifyOtpDto/RequestOtpDto's
// required 8-256 char deviceFingerprint field. Generated once per page load
// so a resend and the verify that follows it share the same value.
function generateFingerprint(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function VerifyPhoneContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pending = searchParams?.get("pending") === "true";
  const prefillPhone = searchParams?.get("phone") ?? "";

  type State = "form" | "verifying" | "success" | "resending" | "resent";
  const [state, setState] = useState<State>("form");
  const [phone, setPhone] = useState(prefillPhone);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [fingerprint] = useState(generateFingerprint);

  useEffect(() => {
    if (!pending && !prefillPhone) {
      router.replace("/login" as any);
    }
  }, [pending, prefillPhone, router]);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifyError(null);
    setState("verifying");
    try {
      const api = createApiClient();
      await api.auth.verifyOtp({
        identifier: phone,
        purpose: "PHONE_VERIFICATION",
        code: code.trim(),
        deviceFingerprint: fingerprint,
      });
      setState("success");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Invalid or expired code. Please try again.";
      setVerifyError(message);
      setState("form");
    }
  }

  async function handleResend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResendError(null);
    setVerifyError(null);
    setState("resending");
    try {
      const api = createApiClient();
      await api.auth.requestOtp({
        identifier: phone,
        purpose: "PHONE_VERIFICATION",
        deviceFingerprint: fingerprint,
      });
      setState("resent");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to resend. Please try again.";
      setResendError(message);
      setState("form");
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-8">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
          Phone verification
        </p>
        <h1 className="text-3xl font-semibold">Verify your phone</h1>
      </div>

      <div className="card card-pad space-y-4">
        {(state === "form" ||
          state === "verifying" ||
          state === "resending" ||
          state === "resent") && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-amber-50">
                <svg
                  className="h-6 w-6 text-[color:var(--accent)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-medium text-[color:var(--ink)]">
                  Check your messages
                </p>
                <p className="mt-1 text-sm muted">
                  We sent a 6-digit verification code to{" "}
                  {phone ? (
                    <span className="font-medium text-[color:var(--ink-2)]">
                      {phone}
                    </span>
                  ) : (
                    "your phone number"
                  )}
                  . Enter it below to activate your account.
                </p>
              </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-3">
              <label className="space-y-2 text-sm">
                <span className="text-[color:var(--ink-2)]">
                  Phone number
                </span>
                <input
                  type="tel"
                  className="input-forumo"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+27821234567"
                  required
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-[color:var(--ink-2)]">
                  Verification code
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="input-forumo"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  required
                />
              </label>
              {verifyError ? (
                <p className="text-sm text-red-600">{verifyError}</p>
              ) : null}
              <button
                type="submit"
                disabled={state === "verifying"}
                className="w-full rounded-md bg-[color:var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[color:var(--accent-2)] disabled:opacity-60"
              >
                {state === "verifying" ? "Verifying…" : "Verify phone"}
              </button>
            </form>

            <div className="border-t border-[color:var(--line)] pt-4 space-y-3">
              <p className="text-xs muted text-center">
                Didn&apos;t receive it?
              </p>
              <form onSubmit={handleResend} className="space-y-2">
                {resendError ? (
                  <p className="text-sm text-red-600">{resendError}</p>
                ) : null}
                {state === "resent" ? (
                  <p className="text-sm text-[color:var(--escrow)]">
                    A new code has been sent.
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={state === "resending" || !phone}
                  className="btn btn-ghost btn-block disabled:opacity-60"
                >
                  {state === "resending" ? "Sending…" : "Resend code"}
                </button>
              </form>
            </div>
          </div>
        )}

        {state === "success" && (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-[color:var(--escrow)]">
              Your phone number has been verified successfully. You can now
              sign in.
            </div>
            <button
              type="button"
              onClick={() => router.push("/login" as any)}
              className="w-full rounded-md bg-[color:var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[color:var(--accent-2)]"
            >
              Sign in to your account
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function VerifyPhonePage() {
  return (
    <Suspense>
      <VerifyPhoneContent />
    </Suspense>
  );
}
