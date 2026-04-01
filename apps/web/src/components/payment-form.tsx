'use client';

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useState } from 'react';

interface PaymentFormProps {
  onSuccess: () => void;
  onError?: (message: string) => void;
}

export function PaymentForm({ onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/app/orders`,
      },
      redirect: 'if_required',
    });

    if (error) {
      const msg = error.message ?? 'Payment failed. Please try again.';
      setErrorMessage(msg);
      onError?.(msg);
    } else {
      onSuccess();
    }

    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      <button
        type="submit"
        className="btn-forumo w-full py-3 font-bold"
        disabled={isLoading || !stripe || !elements}
      >
        {isLoading ? 'Processing payment…' : 'Pay now'}
      </button>
    </form>
  );
}
