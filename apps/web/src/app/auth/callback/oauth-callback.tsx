"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { getApiBaseUrl } from "@forumo/shared";

export function OAuthCallback() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // Exchange the short-lived httpOnly cookie set by the backend for a bearer token.
    // The token is never exposed in the URL — this prevents history/log leakage.
    const apiBase = getApiBaseUrl();
    fetch(`${apiBase}/auth/oauth/exchange`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then(({ accessToken }: { accessToken: string }) => {
        return signIn("token-auth", { token: accessToken, redirect: false });
      })
      .then((result) => {
        if (result?.ok) {
          router.replace("/app");
        } else {
          router.replace("/login?error=oauth_failed");
        }
      })
      .catch(() => router.replace("/login?error=oauth_failed"));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-slate-500">Signing you in…</p>
    </div>
  );
}
