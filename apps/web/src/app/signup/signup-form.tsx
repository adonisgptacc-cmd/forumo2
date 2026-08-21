"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@forumo/shared";

import { createApiClient } from "../../lib/api-client";
import { GoogleSignInButton } from "../../components/google-signin-button";

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
    setIsSubmitting(true);
    try {
      await api.auth.register(form);
      // Backend sends a verification email on registration. Redirect the user to the
      // pending-verification page instead of attempting to sign in (which the backend
      // blocks for unverified accounts).
      router.push(
        ("/verify-email?pending=true&email=" +
          encodeURIComponent(form.email)) as any,
      );
    } catch (err) {
      const apiErrorMessage = err instanceof ApiError ? err.message : null;
      const genericMessage = err instanceof Error ? err.message : null;
      setError(
        apiErrorMessage ||
          genericMessage ||
          "Unable to create account. Try a different email.",
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
          required
        />
      </label>
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
      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[color:var(--line)]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[color:var(--surface)] px-2 muted">or</span>
        </div>
      </div>
      <GoogleSignInButton />
    </form>
  );
}
