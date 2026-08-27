"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@forumo/shared";

import { createApiClient } from "../../lib/api-client";

export function SignupForm() {
  const router = useRouter();
  const api = createApiClient();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!form.email.trim() && !form.phone.trim()) {
      setError("Provide an email or a phone number.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.auth.register({
        name: form.name,
        password: form.password,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      // The backend sends an email verification link (email signups) or an
      // SMS verification code (phone-only signups). Route accordingly —
      // login is blocked until whichever one completes.
      if (form.email.trim()) {
        router.push(
          ("/verify-email?pending=true&email=" +
            encodeURIComponent(form.email)) as any,
        );
      } else {
        router.push(
          ("/verify-phone?pending=true&phone=" +
            encodeURIComponent(form.phone)) as any,
        );
      }
    } catch (err) {
      const apiErrorMessage = err instanceof ApiError ? err.message : null;
      const genericMessage = err instanceof Error ? err.message : null;
      setError(
        apiErrorMessage ||
          genericMessage ||
          "Unable to create account. Try a different email or phone number.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 card card-pad">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="subtle">Full name</span>
          <input
            className="input-forumo"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="subtle">Phone</span>
          <input
            className="input-forumo"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="+27821234567"
          />
        </label>
      </div>
      <label className="space-y-1 text-sm">
        <span className="subtle">Email</span>
        <input
          type="email"
          className="input-forumo"
          value={form.email}
          onChange={(event) => updateField("email", event.target.value)}
        />
      </label>
      <p className="text-xs muted">Provide at least one of email or phone.</p>
      <label className="space-y-1 text-sm">
        <span className="subtle">Password</span>
        <input
          type="password"
          className="input-forumo"
          value={form.password}
          onChange={(event) => updateField("password", event.target.value)}
          required
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        className="btn btn-block bg-emerald-600 text-white hover:bg-emerald-700"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
