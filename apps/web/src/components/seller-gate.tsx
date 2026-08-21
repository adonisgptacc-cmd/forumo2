"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCurrentUser, useBecomeSeller } from "../lib/react-query/hooks";

interface Props {
  children: React.ReactNode;
}

/**
 * Wraps pages that require the SELLER role.
 * BUYER users see an upgrade prompt; all other roles pass through.
 */
export function SellerGate({ children }: Props) {
  const { user, status } = useCurrentUser();
  const becomeSeller = useBecomeSeller();
  const router = useRouter();
  const [done, setDone] = useState(false);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--accent)] border-t-transparent" />
      </div>
    );
  }

  const isBuyer = !user || user.role === "BUYER";

  if (isBuyer && !done) {
    return (
      <div className="mx-auto max-w-md py-16 space-y-6 text-center">
        <div className="space-y-2">
          <div className="text-5xl">🏪</div>
          <h2 className="text-2xl font-bold">Become a Seller</h2>
          <p className="text-sm muted max-w-sm mx-auto">
            Upgrade your account to start listing items, manage orders, and earn
            on Forumo. It&apos;s free and instant.
          </p>
        </div>

        <div className="card card-pad space-y-4 text-left">
          <ul className="space-y-2 text-sm subtle">
            {[
              "List unlimited items for sale",
              "Manage orders and escrow",
              "Accept offers and set prices",
              "Build your seller storefront",
            ].map((benefit) => (
              <li key={benefit} className="flex items-center gap-2">
                <span className="text-[color:var(--accent)]">✓</span>
                {benefit}
              </li>
            ))}
          </ul>

          {becomeSeller.isError && (
            <p className="text-sm text-red-600">
              {(becomeSeller.error as Error)?.message ??
                "Something went wrong. Please try again."}
            </p>
          )}

          <button
            onClick={async () => {
              await becomeSeller.mutateAsync();
              setDone(true);
              // Reload session so the new role is picked up by NextAuth
              router.refresh();
            }}
            disabled={becomeSeller.isPending}
            className="btn btn-primary btn-lg btn-block"
          >
            {becomeSeller.isPending
              ? "Upgrading…"
              : "Activate seller account — free"}
          </button>
          <p className="text-center text-xs muted">
            You can always manage your account in{" "}
            <a
              href="/app/profile"
              className="text-[color:var(--accent)] hover:underline"
            >
              Profile
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
