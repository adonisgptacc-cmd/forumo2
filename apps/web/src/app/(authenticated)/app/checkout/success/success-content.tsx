"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useVerifyPaystackPayment,
  useOrder,
} from "../../../../../lib/react-query/hooks";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    cents / 100,
  );
}

export function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifyPaystack = useVerifyPaystackPayment();
  const verifyAttempted = useRef(false);

  const [orderId, setOrderId] = useState<string | null>(
    searchParams?.get("orderId") ?? null,
  );
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const reference = searchParams?.get("reference");

  // Verify Paystack payment when the reference param is present (Paystack redirect).
  useEffect(() => {
    if (!reference || verifyAttempted.current || orderId) return;
    verifyAttempted.current = true;
    setVerifying(true);
    verifyPaystack.mutate(reference, {
      onSuccess: (result) => {
        setOrderId(result.orderId);
        setVerifying(false);
      },
      onError: (err) => {
        setVerifyError(
          err instanceof Error ? err.message : "Payment verification failed.",
        );
        setVerifying(false);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: order, isLoading: orderLoading } = useOrder(orderId);

  if (verifying) {
    return (
      <div className="card-forumo text-center py-16 space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto" />
        <p className="text-slate-600 font-medium">Verifying your payment…</p>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="card-forumo border border-red-200 bg-red-50 space-y-2">
          <p className="text-sm font-semibold text-red-700">
            Payment verification failed
          </p>
          <p className="text-sm text-red-600">{verifyError}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={"/app/cart" as any}
            className="btn-forumo px-6 py-2 text-sm"
          >
            Return to cart
          </Link>
          <Link
            href="/app/orders"
            className="px-6 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            View orders
          </Link>
        </div>
      </div>
    );
  }

  // If no orderId and no reference, nothing to show — send to orders list
  if (!orderId && !reference) {
    router.replace("/app/orders" as any);
    return null;
  }

  if (orderLoading || !order) {
    return (
      <div className="card-forumo text-center py-16 space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto" />
        <p className="text-slate-500">Loading order details…</p>
      </div>
    );
  }

  const totalPaid = order.totalItemCents + order.shippingCents + order.feeCents;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Confirmation banner */}
      <div className="card-forumo text-center py-8 space-y-3">
        <div className="text-5xl">✓</div>
        <h2 className="text-2xl font-bold text-green-600">
          Payment confirmed!
        </h2>
        <p className="text-slate-600">
          Thank you for your purchase. Your order is being processed.
        </p>
      </div>

      {/* Order details */}
      <div className="card-forumo space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Order number</p>
            <p className="font-bold font-mono text-lg">{order.orderNumber}</p>
          </div>
          <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
            {order.status}
          </span>
        </div>
        <hr className="border-slate-100" />
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">
            {order.items.length} item{order.items.length !== 1 ? "s" : ""}
          </span>
          <span className="font-medium">
            {formatPrice(order.totalItemCents, order.currency)}
          </span>
        </div>
        {order.shippingCents > 0 && (
          <div className="flex justify-between text-sm text-slate-600">
            <span>Shipping</span>
            <span>{formatPrice(order.shippingCents, order.currency)}</span>
          </div>
        )}
        {order.feeCents > 0 && (
          <div className="flex justify-between text-sm text-slate-600">
            <span>Platform fee</span>
            <span>{formatPrice(order.feeCents, order.currency)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-100">
          <span>Total paid</span>
          <span>{formatPrice(totalPaid, order.currency)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/app/orders/${order.id}` as any}
          className="btn-forumo flex-1 text-center py-2.5 font-semibold"
        >
          Track your order
        </Link>
        <Link
          href="/listings"
          className="flex-1 text-center py-2.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
