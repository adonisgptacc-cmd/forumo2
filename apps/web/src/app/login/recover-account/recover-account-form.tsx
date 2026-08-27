"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@forumo/shared";

import { createApiClient } from "../../../lib/api-client";
import { set2FaToken } from "../../../lib/2fa-store";
import { getRecoveryEmail } from "../../../lib/recovery-store";

export function RecoverAccountForm() {
  const router = useRouter();
  const email = getRecoveryEmail() ?? "";
  const api = createApiClient();

  const [step, setStep] = useState<"request" | "confirm">("request");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestCode() {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.auth.recoverOAuthAccount.request(email);
      setStep("confirm");
    } catch (err) {
      const apiErrorMessage = err instanceof ApiError ? err.message : null;
      setError(apiErrorMessage ?? "Unable to send a recovery code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await api.auth.recoverOAuthAccount.confirm({
        email,
        code,
        newPassword,
        phone: phone.trim() || undefined,
      });
      set2FaToken(result.twoFactorToken, "/app");
      router.push("/login/2fa?mode=setup" as any);
    } catch (err) {
      const apiErrorMessage = err instanceof ApiError ? err.message : null;
      setError(apiErrorMessage ?? "Invalid or expired code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === "request") {
    return (
      <div className="space-y-4 card card-pad">
        <p className="text-sm">
          We&apos;ll email a code to <strong>{email}</strong>.
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={isSubmitting || !email}
          onClick={handleRequestCode}
        >
          {isSubmitting ? "Sending…" : "Send recovery code"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleConfirm} className="space-y-4 card card-pad">
      <label className="space-y-1 text-sm">
        <span className="subtle">Code</span>
        <input
          className="input-forumo"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={6}
          required
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="subtle">New password</span>
        <input
          type="password"
          className="input-forumo"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="subtle">Phone (optional)</span>
        <input
          className="input-forumo"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+27821234567"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Setting password…" : "Set password"}
      </button>
    </form>
  );
}
