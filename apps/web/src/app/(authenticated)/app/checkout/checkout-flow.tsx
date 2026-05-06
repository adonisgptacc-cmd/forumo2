'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCart } from '../../../../lib/cart-context';
import {
  useCurrentUser,
  useCreateOrder,
  useInitiatePayment,
  useVerifyPaystackPayment,
  useAddresses,
  useFeePreview,
} from '../../../../lib/react-query/hooks';
import { StripeProvider } from '../../../../components/stripe-provider';
import { PaymentForm } from '../../../../components/payment-form';
import { ErrorBoundary } from '../../../../components/ErrorBoundary';
import type { SafeOrder } from '@forumo/shared';

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100);
}

type CheckoutStep = 'review' | 'payment' | 'verifying' | 'confirmed';

const PAYSTACK_CURRENCIES = new Set(['NGN', 'GHS', 'KES', 'ZAR']);

function PaymentProviderLogo({ provider }: { provider: 'stripe' | 'paystack' }) {
  if (provider === 'paystack') {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#00c3f7]/10 text-[#00c3f7] rounded font-semibold text-xs tracking-wide">
          Paystack
        </span>
        <span>Secure African payment</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#635BFF]/10 text-[#635BFF] rounded font-semibold text-xs tracking-wide">
        Stripe
      </span>
      <span>Secure payment</span>
    </div>
  );
}

function SellerOrderCard({
  sellerId,
  sellerItems,
  error,
}: {
  sellerId: string;
  sellerItems: ReturnType<typeof useCart>['items'];
  error?: string;
}) {
  const subtotal = sellerItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  const currency = sellerItems[0]?.currency ?? 'USD';
  const primaryListingId = sellerItems[0]?.listingId ?? null;
  const { data: feePreview } = useFeePreview(primaryListingId, subtotal);
  const isPaystack = PAYSTACK_CURRENCIES.has(currency.toUpperCase());

  return (
    <div className="card-forumo space-y-3">
      <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
        Seller: {sellerItems[0]?.sellerName ?? sellerId.slice(0, 8)}
      </p>
      {sellerItems.map((item) => (
        <div
          key={`${item.listingId}:${item.variantId ?? ''}`}
          className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0"
        >
          <div>
            <p className="font-medium">{item.title}</p>
            {item.variantLabel && <p className="text-slate-400 text-xs">{item.variantLabel}</p>}
            <p className="text-slate-500">Qty: {item.quantity}</p>
          </div>
          <p className="font-semibold">{formatPrice(item.priceCents * item.quantity, item.currency)}</p>
        </div>
      ))}
      <div className="flex justify-between text-sm pt-1 text-slate-600">
        <span>Subtotal</span>
        <span>{formatPrice(subtotal, currency)}</span>
      </div>
      {feePreview && feePreview.feeAmountCents > 0 && (
        <div className="flex justify-between text-sm text-slate-500">
          <span>Platform fee ({feePreview.feePercent}%)</span>
          <span>{formatPrice(feePreview.feeAmountCents, currency)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold pt-1 border-t border-slate-100">
        <span>Order total</span>
        <span>{formatPrice(subtotal + (feePreview?.feeAmountCents ?? 0), currency)}</span>
      </div>
      <PaymentProviderLogo provider={isPaystack ? 'paystack' : 'stripe'} />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function CheckoutFlow() {
  const { items, groupedBySeller, clearSellerItems, itemCount } = useCart();
  const { user } = useCurrentUser();
  const createOrder = useCreateOrder();
  const initiatePayment = useInitiatePayment();
  const verifyPaystack = useVerifyPaystackPayment();
  const { data: addresses = [] } = useAddresses();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<CheckoutStep>('review');
  const [confirmedOrders, setConfirmedOrders] = useState<SafeOrder[]>([]);
  const [pendingPayments, setPendingPayments] = useState<{ orderId: string; clientSecret: string }[]>([]);
  const [placingFor, setPlacingFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const shippingAddresses = addresses.filter((a) => a.type === 'SHIPPING' || a.type === 'PICKUP' || !a.type);
  const defaultAddr = shippingAddresses.find((a) => a.isDefault) ?? shippingAddresses[0] ?? null;
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const effectiveAddressId = selectedAddressId ?? defaultAddr?.id ?? null;
  const paystackVerifyAttempted = useRef(false);

  // Handle Paystack redirect callback: /app/checkout?reference=xxx
  useEffect(() => {
    const reference = searchParams?.get('reference');
    const mock = searchParams?.get('mock');
    if (!reference || paystackVerifyAttempted.current) return;
    paystackVerifyAttempted.current = true;
    setStep('verifying');

    if (mock === 'true') {
      // Dev mock — skip real verify
      setStep('confirmed');
      return;
    }

    verifyPaystack.mutate(reference, {
      onSuccess: () => setStep('confirmed'),
      onError: (err) => {
        setErrors({ verify: err instanceof Error ? err.message : 'Payment verification failed' });
        setStep('review');
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (step === 'verifying') {
    return (
      <div className="card-forumo text-center py-16 space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto" />
        <p className="text-slate-600 font-medium">Verifying your payment…</p>
      </div>
    );
  }

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
          <div className="mb-4">
            <PaymentProviderLogo provider="stripe" />
          </div>
          <ErrorBoundary
            fallback={
              <div className="py-8 text-center space-y-2">
                <p className="text-sm font-medium text-slate-700">Payment form couldn&apos;t load</p>
                <p className="text-xs text-slate-500">Please refresh the page and try again, or contact support.</p>
              </div>
            }
          >
            <StripeProvider clientSecret={payment.clientSecret}>
              <PaymentForm
                onSuccess={() => setStep('confirmed')}
                onError={(msg) => setErrors((prev) => ({ ...prev, stripe: msg }))}
              />
            </StripeProvider>
          </ErrorBoundary>
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
        shippingAddressId: effectiveAddressId ?? undefined,
        items: sellerItems.map((item) => ({
          listingId: item.listingId,
          variantId: item.variantId ?? undefined,
          quantity: item.quantity,
        })),
      });
      setConfirmedOrders((prev) => [...prev, order]);
      clearSellerItems(sellerId);

      try {
        const result = await initiatePayment.mutateAsync(order.id);
        if (result.provider === 'paystack' && result.authorizationUrl) {
          // Redirect to Paystack hosted checkout page
          window.location.href = result.authorizationUrl;
          return; // navigation in progress — don't continue
        }
        if (result.provider === 'stripe' && result.clientSecret) {
          setPendingPayments((prev) => [...prev, { orderId: order.id, clientSecret: result.clientSecret! }]);
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
    const newPending: { orderId: string; clientSecret: string }[] = [];

    for (const [sellerId, sellerItems] of groupedBySeller.entries()) {
      if (!user) return;
      setPlacingFor(sellerId);
      setErrors((prev) => ({ ...prev, [sellerId]: '' }));
      try {
        const order = await createOrder.mutateAsync({
          buyerId: user.id,
          sellerId,
          currency: sellerItems[0]?.currency ?? 'USD',
          shippingAddressId: effectiveAddressId ?? undefined,
          items: sellerItems.map((item) => ({
            listingId: item.listingId,
            variantId: item.variantId ?? undefined,
            quantity: item.quantity,
          })),
        });
        setConfirmedOrders((prev) => [...prev, order]);
        clearSellerItems(sellerId);

        try {
          const result = await initiatePayment.mutateAsync(order.id);
          if (result.provider === 'paystack' && result.authorizationUrl) {
            // Redirect immediately — Paystack will bring the user back
            window.location.href = result.authorizationUrl;
            return;
          }
          if (result.provider === 'stripe' && result.clientSecret) {
            newPending.push({ orderId: order.id, clientSecret: result.clientSecret });
          }
        } catch {
          // non-fatal
        }
      } catch (err) {
        setErrors((prev) => ({ ...prev, [sellerId]: err instanceof Error ? err.message : 'Order failed. Please try again.' }));
      } finally {
        setPlacingFor(null);
      }
    }

    setPendingPayments(newPending);
    setStep(newPending.length > 0 ? 'payment' : 'confirmed');
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Checkout</p>
        <h1 className="text-2xl font-bold">Review your order</h1>
      </div>

      {errors.verify && (
        <div className="card-forumo border border-red-200 bg-red-50">
          <p className="text-sm text-red-600">{errors.verify}</p>
        </div>
      )}

      {Array.from(groupedBySeller.entries()).map(([sellerId, sellerItems]) => (
        <SellerOrderCard
          key={sellerId}
          sellerId={sellerId}
          sellerItems={sellerItems}
          error={errors[sellerId]}
        />
      ))}

      {/* Shipping address picker */}
      <div className="card-forumo space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Shipping address</p>
          <Link href="/app/profile" className="text-xs text-forumo-link hover:underline">
            Manage addresses
          </Link>
        </div>
        {shippingAddresses.length === 0 ? (
          <p className="text-sm text-slate-500">
            No saved addresses.{' '}
            <Link href="/app/profile" className="text-forumo-link hover:underline">Add one in your profile</Link>.
          </p>
        ) : (
          <div className="space-y-2">
            {shippingAddresses.map((addr) => {
              const isSelected = (selectedAddressId ?? defaultAddr?.id) === addr.id;
              return (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => setSelectedAddressId(addr.id)}
                  className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-200 hover:border-amber-300'
                  }`}
                >
                  <p className="font-medium">{addr.label ?? addr.fullName}</p>
                  <p className="text-slate-500 text-xs">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                  <p className="text-slate-500 text-xs">{addr.city}, {addr.state} {addr.postalCode}, {addr.country}</p>
                  {addr.isDefault && <span className="text-xs text-amber-600">Default</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="card-forumo space-y-3">
        <div className="flex justify-between text-sm text-slate-500">
          <span>Items subtotal</span>
          <span>{formatPrice(
            Array.from(groupedBySeller.values()).flat().reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
            items[0]?.currency ?? 'USD'
          )}</span>
        </div>
        <p className="text-xs text-slate-400">Platform fees and order totals are shown per seller above.</p>
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
