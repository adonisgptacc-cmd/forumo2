"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@forumo/shared";

function MagicVerify() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search?.get("token");
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current || !token) return;
    ran.current = true;
    const base = getApiBaseUrl();
    fetch(`${base}/auth/magic/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { accessToken?: string; twoFactorToken?: string }) => {
        if (data.accessToken) {
          return signIn("token-auth", {
            token: data.accessToken,
            redirect: false,
          }).then((r) => {
            if (r?.ok) router.replace("/app");
            else router.replace("/login?error=magic_failed");
          });
        }
        if (data.twoFactorToken) {
          // 2FA required after magic link
          sessionStorage.setItem("forumo-2fa-token", data.twoFactorToken);
          router.replace("/login/2fa?mode=verify" as never);
        } else {
          router.replace("/login?error=magic_failed");
        }
      })
      .catch(() => setError("Magic link invalid or expired"));
  }, [token, router]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!token) return <p className="text-slate-500">Missing token</p>;
  return <p className="text-slate-500">Verifying magic link…</p>;
}

export default function MagicPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <div className="flex min-h-screen items-center justify-center">
        <MagicVerify />
      </div>
    </Suspense>
  );
}
