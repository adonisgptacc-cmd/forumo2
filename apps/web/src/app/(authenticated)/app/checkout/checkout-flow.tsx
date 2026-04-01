'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '../../../../lib/cart-context';
import { useCurrentUser, useCreateOrder, useInitiatePayment } from '../../../../lib/react-query/hooks';
import { StripeProvider } from '../../../../components/stripe-provider';
import { PaymentForm } from '../../../../components/payment-form';
import type { SafeOrder } from '@forumo/shared';

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100);
}

type CheckoutStep = 'review' | 'payment' | 'confirmed';

export function CheckoutFlow() {
  const { items, groupedBySeller, clearSellerItems, itemCount } = useCart();
  const { user } = useCurrentUser();
  const createOrder = useCreateOrder();
  const initiatePayment = useInitiatePayment();
  const [step, setStep] = useState<CheckoutStep>('review');
  const [confirmedOrders, setConfirmedOrders] = useState<SafeOrder[]>([]);
  const [pendingPayments, setPendingPayments] = useState<{ orderId: string; clientSecret: string }[]>([]);
  const [placingFor, setPlacingFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (itemCount === 0 && step === 'review') {
    return (
      <div className="card-forumo text-center py-16 space-y-3">
        <p className="text-slate-500 font-medium">Your cart is empty</p>
        <Link href="/listings" className="btn-forumo inline-block px-6 py-2 text-sm">Browse listings</Link>
      </div>
    );
  }

  if (step === 'payment' && pendingPayments.length > 0) {
    const payment = pendingPayments[0];
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Checkout</p>
          <h1 className="text-2xl font-bold">Complete Payment</h1>
          <p className="text-sm text-slate-500 mt-1">Your order has been created. Please complete payment to confirm.</p>
        </div>
        <div className="card-forumo">
          <StripeProvider clientSecret={payment.clientSecret}>
            <PaymentForm
              onSuccess={() => setStep('confirmed')}
              onError={(msg) => setErrors((prev) => ({ ...prev, stripe: msg }))}
            />
          </StripeProvider>
          {errors.stripe && <p className="text-sm text-red-600 mt-2">{errors.stripe}</p>}
        </div>
      </div>
    );
  }

  if (step === 'confirmed') {
    return (
      <div className="space-y-4">
        <div className="card-forumo text-center py-8 space-y-3">
          <div className="text-5xl">✓</div>
          <h2 className="text-2xl font-bold text-green-600">Order Placed!</h2>
          <p className="text-slate-600">Thank you for your purchase. Your order is being processed.</p>
        </div>
        {confirmedOrders.map((order) => (
          <div key={order.id} className="card-forumo space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Order number</p>
                <p className="font-bold font-mono">{order.orderNumber}</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">{order.status}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
              <span className="font-semibold">{formatPrice(order.totalItemCents, order.currency)}</span>
            </div>
          </div>
        ))}
        <div className="flex gap-3">
          <Link href="/app/orders" className="btn-forumo flex-1 text-center py-2">View My Orders</Link>
          <Link href="/listings" className="flex-1 text-center py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Continue Shopping</Link>
        </div>
      </div>
    );
  }

  async function placeOrderForSeller(sellerId: string, sellerItems: typeof items) {
    if (!user) return;
    setPlacingFor(sellerId);
    setErrors((prev) => ({ ...prev, [sellerId]: '' }));
    try {
      const order = await createOrder.mutateAsync({
        buyerId: user.id,
        sellerId,
        currency: sellerItems[0]?.currency ?? 'USD',
        items: sellerItems.map((item) => ({
          listingId: item.listingId,
          variantId: item.variantId ?? undefined,
          quantity: item.quantity,
        })),
      });
      setConfirmedOrders((prev) => [...prev, order]);
      clearSellerItems(sellerId);

      // Try to initiate payment (get Stripe clientSecret)
      try {
        const { clientSecret } = await initiatePayment.mutateAsync(order.id);
        // Only add real Stripe secrets (not mock pi_ values that need Elements)
        if (clientSecret && (clientSecret.startsWith('pi_') || clientSecret.startsWith('cs_'))) {
          setPendingPayments((prev) => [...prev, { orderId: order.id, clientSecret }]);
        }
      } catch {
        // Payment initiation failure is non-fatal — order was still created
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, [sellerId]: err instanceof Error ? err.message : 'Order failed. Please try again.' }));
    } finally {
      setPlacingFor(null);
    }
  }

  async function placeAllOrders() {
    if (!user) return;
    for (const [sellerId, sellerItems] of groupedBySeller.entries()) {
      await placeOrderForSeller(sellerId, sellerItems);
    }
    setStep(pendingPayments.length > 0 ? 'payment' : 'confirmed');
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Checkout</p>
        <h1 className="text-2xl font-bold">Review your order</h1>
      </div>

      {Array.from(groupedBySeller.entries()).map(([sellerId, sellerItems]) => {
        const subtotal = sellerItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
        const currency = sellerItems[0]?.currency ?? 'USD';
        const isPlacing = placingFor === sellerId;
        return (
          <div key={sellerId} className="card-forumo space-y-3">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
              Seller: {sellerItems[0]?.sellerName ?? sellerId.slice(0, 8)}
            </p>
            {sellerItems.map((item) => (
              <div key={`${item.listingId}:${item.variantId ?? ''}`} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                <div>
                  <p className="font-medium">{item.title}</p>
                  {item.variantLabel && <p className="text-slate-400 text-xs">{item.variantLabel}</p>}
                  <p className="text-slate-500">Qty: {item.quantity}</p>
                </div>
                <p className="font-semibold">{formatPrice(item.priceCents * item.quantity, item.currency)}</p>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-1">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal, currency)}</span>
            </div>
            {errors[sellerId] && <p className="text-sm text-red-600">{errors[sellerId]}</p>}
          </div>
        );
      })}

      <div className="card-forumo space-y-3">
        <div className="flex justify-between font-bold text-lg">
          <span>Grand Total</span>
          <span>{formatPrice(
            Array.from(groupedBySeller.values()).flat().reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
            items[0]?.currency ?? 'USD'
          )}</span>
        </div>
        <button
          type="button"
          className="btn-forumo w-full py-3 text-lg font-bold"
          onClick={placeAllOrders}
          disabled={createOrder.isPending || !!placingFor}
        >
          {placingFor ? 'Placing order…' : 'Place Order'}
        </button>
        <Link href={"/app/cart" as any} className="block text-center text-sm text-forumo-link hover:underline">
          ← Back to cart
        </Link>
      </div>
    </div>
  );
}
