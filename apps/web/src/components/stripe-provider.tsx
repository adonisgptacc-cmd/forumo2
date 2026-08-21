"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useMemo } from "react";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

interface StripeProviderProps {
  clientSecret: string;
  children: React.ReactNode;
}

export function StripeProvider({
  clientSecret,
  children,
}: StripeProviderProps) {
  const stripePromise = useMemo(
    () => (stripePublishableKey ? loadStripe(stripePublishableKey) : null),
    [],
  );

  if (!stripePromise) {
    return <>{children}</>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      {children}
    </Elements>
  );
}
