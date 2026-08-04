"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "../../../../lib/cart-context";
import type { CartItem } from "../../../../lib/cart-context";
import {
  useCurrentUser,
  useCreateOrder,
  useInitiatePayment,
  useAddresses,
  useFeePreview,
  useGetShippingRates,
} from "../../../../lib/react-query/hooks";
import { StripeProvider } from "../../../../components/stripe-provider";
import { PaymentForm } from "../../../../components/payment-form";
import { ErrorBoundary } from "../../../../components/ErrorBoundary";
import type { ShippingRate } from "@forumo/shared";

type Step = "shipping" | "payment";

const PAYSTACK_CURRENCIES = new Set(["NGN", "GHS", "KES", "ZAR"]);

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    cents / 100,
  );
}

// Warehouse origin addresses used as Shippo fromAddress when seller address is unavailable.
// Derived from currency so rates are for the correct country.
function defaultFromAddress(currency: string) {
  switch (currency.toUpperCase()) {
    case "ZAR":
      return {
        name: "Forumo ZA",
        street1: "1 Long Street",
        city: "Cape Town",
        country: "ZA",
        state: "WC",
        zip: "8001",
      };
    case "NGN":
      return {
        name: "Forumo NG",
        street1: "1 Broad Street",
        city: "Lagos",
        country: "NG",
        state: "LA",
        zip: "101001",
      };
    case "GHS":
      return {
        name: "Forumo GH",
        street1: "1 Ring Road",
        city: "Accra",
        country: "GH",
        state: "GA",
        zip: "00233",
      };
    case "KES":
      return {
        name: "Forumo KE",
        street1: "1 Moi Avenue",
        city: "Nairobi",
        country: "KE",
        state: "NAI",
        zip: "00100",
      };
    default:
      return {
        name: "Forumo US",
        street1: "1 Market St",
        city: "San Francisco",
        country: "US",
        state: "CA",
        zip: "94105",
      };
  }
}

const DEFAULT_PARCEL = { weight: 1, length: 20, width: 15, height: 10 };

// --- Order summary card shown in the payment step sidebar ---
function SellerSummaryCard({
  sellerId,
  sellerItems,
  selectedRate,
}: {
  sellerId: string;
  sellerItems: CartItem[];
  selectedRate: ShippingRate | null;
}) {
  const subtotal = sellerItems.reduce(
    (s, i) => s + i.priceCents * i.quantity,
    0,
  );
  const currency = sellerItems[0]?.currency ?? "USD";
  const primaryListingId = sellerItems[0]?.listingId ?? null;
  const { data: feePreview } = useFeePreview(primaryListingId, subtotal);
  const shippingCents = selectedRate?.price ?? 0;
  const feeCents = feePreview?.feeAmountCents ?? 0;

  return (
    <div className="card-forumo space-y-2">
      <p className="text-xs font-semibold text-[color:var(--ink-3)] uppercase tracking-wide">
        {sellerItems[0]?.sellerName ?? sellerId.slice(0, 8)}
      </p>
      {sellerItems.map((item) => (
        <div
          key={`${item.listingId}:${item.variantId ?? ""}`}
          className="flex justify-between text-sm py-1 border-b border-[color:var(--line)] last:border-0"
        >
          <div>
            <p className="font-medium">{item.title}</p>
            {item.variantLabel && (
              <p className="text-slate-400 text-xs">{item.variantLabel}</p>
            )}
            <p className="text-[color:var(--ink-3)] text-xs">
              Qty: {item.quantity}
            </p>
          </div>
          <p className="font-semibold">
            {formatPrice(item.priceCents * item.quantity, currency)}
          </p>
        </div>
      ))}
      <div className="flex justify-between text-sm text-[color:var(--ink-2)] pt-1">
        <span>Items subtotal</span>
        <span>{formatPrice(subtotal, currency)}</span>
      </div>
      <div className="flex justify-between text-sm text-[color:var(--ink-2)]">
        <span>Shipping</span>
        {selectedRate ? (
          <span>{formatPrice(shippingCents, selectedRate.currency)}</span>
        ) : (
          <span className="text-slate-400">TBD</span>
        )}
      </div>
      {feeCents > 0 && (
        <div className="flex justify-between text-sm text-[color:var(--ink-3)]">
          <span>Platform fee ({feePreview?.feePercent}%)</span>
          <span>{formatPrice(feeCents, currency)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-base pt-2 border-t border-[color:var(--line)]">
        <span>Order total</span>
        <span>
          {formatPrice(subtotal + shippingCents + feeCents, currency)}
        </span>
      </div>
    </div>
  );
}

export function CheckoutFlow() {
  const router = useRouter();
  const { items, groupedBySeller, clearSellerItems, itemCount } = useCart();
  const { user } = useCurrentUser();
  const createOrder = useCreateOrder();
  const initiatePayment = useInitiatePayment();
  const getShippingRates = useGetShippingRates();
  const { data: rawAddresses = [] } = useAddresses();

  const [step, setStep] = useState<Step>("shipping");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  // Set when a Stripe order has been created and we need to show the card form
  const [stripePayment, setStripePayment] = useState<{
    orderId: string;
    clientSecret: string;
  } | null>(null);

  const addresses = rawAddresses as any[];
  const shippingAddresses = addresses.filter(
    (a) => !a.type || a.type === "SHIPPING" || a.type === "PICKUP",
  );
  const defaultAddr =
    shippingAddresses.find((a: any) => a.isDefault) ??
    shippingAddresses[0] ??
    null;
  const effectiveAddressId: string | null =
    selectedAddressId ?? defaultAddr?.id ?? null;
  const effectiveAddress =
    shippingAddresses.find((a: any) => a.id === effectiveAddressId) ?? null;
  const selectedRate =
    shippingRates.find((r) => r.rateId === selectedRateId) ?? null;

  const currency = items[0]?.currency ?? "USD";
  const isPaystack = PAYSTACK_CURRENCIES.has(currency.toUpperCase());

  // Redirect if cart is empty (but keep the page alive while Stripe form is showing
  // so the user doesn't get bounced mid-payment)
  if (itemCount === 0 && !stripePayment) {
    router.replace("/app/cart" as any);
    return null;
  }

  async function fetchRates() {
    if (!effectiveAddress) return;
    setRatesLoading(true);
    setRatesError(null);
    setShippingRates([]);
    setSelectedRateId(null);
    try {
      const rates = await getShippingRates.mutateAsync({
        fromAddress: defaultFromAddress(currency),
        toAddress: {
          name: effectiveAddress.fullName,
          street1: effectiveAddress.line1,
          city: effectiveAddress.city,
          country: effectiveAddress.country,
          state: effectiveAddress.state ?? undefined,
          zip: effectiveAddress.postalCode ?? undefined,
        },
        parcel: DEFAULT_PARCEL,
      });
      setShippingRates(rates);
      if (rates.length > 0) setSelectedRateId(rates[0].rateId);
    } catch {
      setRatesError(
        "Could not fetch shipping rates. You can still proceed without selecting a rate.",
      );
    } finally {
      setRatesLoading(false);
    }
  }

  async function placeOrders() {
    if (!user) return;
    setPlacingOrder(true);
    setOrderError(null);
    const shippingCents = selectedRate?.price ?? 0;

    try {
      for (const [sellerId, sellerItems] of groupedBySeller.entries()) {
        const order = await createOrder.mutateAsync({
          buyerId: user.id,
          sellerId,
          currency: sellerItems[0]?.currency ?? "USD",
          shippingAddressId: effectiveAddressId ?? undefined,
          shippingCents,
          items: sellerItems.map((item) => ({
            listingId: item.listingId,
            variantId: item.variantId ?? undefined,
            quantity: item.quantity,
          })),
        });

        clearSellerItems(sellerId);

        const payment = await initiatePayment.mutateAsync(order.id);

        if (payment.provider === "paystack" && payment.authorizationUrl) {
          window.location.href = payment.authorizationUrl;
          return;
        }

        if (payment.provider === "stripe" && payment.clientSecret) {
          setStripePayment({
            orderId: order.id,
            clientSecret: payment.clientSecret,
          });
          return;
        }
      }

      // All orders placed; no payment gateway needed (shouldn't normally happen)
      router.push("/app/orders" as any);
    } catch (err) {
      setOrderError(
        err instanceof Error
          ? err.message
          : "Failed to place order. Please try again.",
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  // --- Stripe Elements overlay (rendered after order creation) ---
  if (stripePayment) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-[color:var(--ink-3)]">
            Checkout · Step 2
          </p>
          <h1 className="text-2xl font-bold">Complete Payment</h1>
          <p className="text-sm text-[color:var(--ink-3)] mt-1">
            Your order has been created. Enter your card details to confirm.
          </p>
        </div>
        <div className="card-forumo">
          <div className="mb-4 flex items-center gap-2 text-xs text-[color:var(--ink-3)]">
            <span className="px-2 py-1 bg-[#635BFF]/10 text-[#635BFF] rounded font-semibold tracking-wide">
              Stripe
            </span>
            <span>Secure payment</span>
          </div>
          <ErrorBoundary
            fallback={
              <p className="text-sm text-[color:var(--ink-3)] py-4 text-center">
                Payment form couldn&apos;t load. Please refresh the page.
              </p>
            }
          >
            <StripeProvider clientSecret={stripePayment.clientSecret}>
              <PaymentForm
                orderId={stripePayment.orderId}
                onSuccess={() =>
                  router.push(
                    `/app/checkout/success?orderId=${stripePayment!.orderId}` as any,
                  )
                }
                onError={(msg) => setOrderError(msg)}
              />
            </StripeProvider>
          </ErrorBoundary>
          {orderError && (
            <p className="text-sm text-red-600 mt-2">{orderError}</p>
          )}
        </div>
        <button
          type="button"
          className="text-sm text-[color:var(--ink-3)] hover:underline"
          onClick={() => {
            setStripePayment(null);
            setOrderError(null);
          }}
        >
          ← Cancel and go back
        </button>
      </div>
    );
  }

  // --- Step 1: Shipping ---
  if (step === "shipping") {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-[color:var(--ink-3)]">
            Checkout · Step 1 of 2
          </p>
          <h1 className="text-2xl font-bold">Shipping</h1>
        </div>

        {orderError && (
          <div className="card-forumo border border-red-200 bg-red-50">
            <p className="text-sm text-red-600">{orderError}</p>
          </div>
        )}

        {/* Compact items summary */}
        <div className="card-forumo space-y-3">
          <p className="text-sm font-semibold text-[color:var(--ink)]">
            Your items
          </p>
          {Array.from(groupedBySeller.entries()).map(
            ([sellerId, sellerItems]) => (
              <div key={sellerId} className="space-y-1">
                <p className="text-xs text-[color:var(--ink-3)] font-medium uppercase tracking-wide">
                  {sellerItems[0]?.sellerName ?? sellerId.slice(0, 8)}
                </p>
                {sellerItems.map((item) => (
                  <div
                    key={`${item.listingId}:${item.variantId ?? ""}`}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-[color:var(--ink)] truncate mr-2">
                      {item.title} × {item.quantity}
                    </span>
                    <span className="font-medium shrink-0">
                      {formatPrice(
                        item.priceCents * item.quantity,
                        item.currency,
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ),
          )}
        </div>

        {/* Address picker */}
        <div className="card-forumo space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              Shipping address
            </p>
            <Link
              href="/app/profile"
              className="text-xs text-forumo-link hover:underline"
            >
              Manage addresses
            </Link>
          </div>
          {shippingAddresses.length === 0 ? (
            <p className="text-sm text-[color:var(--ink-3)]">
              No saved addresses.{" "}
              <Link
                href="/app/profile"
                className="text-forumo-link hover:underline"
              >
                Add one in your profile
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-2">
              {shippingAddresses.map((addr: any) => {
                const isSelected = effectiveAddressId === addr.id;
                return (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => {
                      setSelectedAddressId(addr.id);
                      // Reset rates when address changes
                      setShippingRates([]);
                      setSelectedRateId(null);
                      setRatesError(null);
                    }}
                    className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                      isSelected
                        ? "border-[color:var(--accent)] bg-[color:var(--accent-bg)]"
                        : "border-[color:var(--line)] hover:border-[color:var(--accent)]"
                    }`}
                  >
                    <p className="font-medium">{addr.label ?? addr.fullName}</p>
                    <p className="text-[color:var(--ink-3)] text-xs">
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ""}
                    </p>
                    <p className="text-[color:var(--ink-3)] text-xs">
                      {addr.city}, {addr.state} {addr.postalCode},{" "}
                      {addr.country}
                    </p>
                    {addr.isDefault && (
                      <span className="text-xs text-[color:var(--accent-2)]">
                        Default
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Shipping rate selector — shown only once an address is selected */}
        {effectiveAddress && (
          <div className="card-forumo space-y-3">
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              Shipping method
            </p>

            {shippingRates.length === 0 && !ratesLoading && !ratesError && (
              <button
                type="button"
                onClick={fetchRates}
                className="text-sm text-forumo-link hover:underline"
              >
                Get shipping rates →
              </button>
            )}

            {ratesLoading && (
              <div className="flex items-center gap-2 text-sm text-[color:var(--ink-3)]">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[color:var(--accent)] shrink-0" />
                Fetching rates…
              </div>
            )}

            {ratesError && (
              <div className="space-y-1">
                <p className="text-sm text-[color:var(--accent-2)]">
                  {ratesError}
                </p>
                <button
                  type="button"
                  onClick={fetchRates}
                  className="text-xs text-forumo-link hover:underline"
                >
                  Try again
                </button>
              </div>
            )}

            {shippingRates.length > 0 && (
              <div className="space-y-2">
                {shippingRates.map((rate) => {
                  const isSelected = selectedRateId === rate.rateId;
                  return (
                    <button
                      key={rate.rateId}
                      type="button"
                      onClick={() => setSelectedRateId(rate.rateId)}
                      className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                        isSelected
                          ? "border-[color:var(--accent)] bg-[color:var(--accent-bg)]"
                          : "border-[color:var(--line)] hover:border-[color:var(--accent)]"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            {rate.carrier} — {rate.service}
                          </p>
                          {rate.estimatedDays != null && (
                            <p className="text-[color:var(--ink-3)] text-xs">
                              Est. {rate.estimatedDays} day
                              {rate.estimatedDays !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                        <span className="font-bold">
                          {formatPrice(rate.price, rate.currency)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <button
            type="button"
            className="btn-forumo w-full py-3 text-base font-bold disabled:opacity-50"
            onClick={() => {
              if (!effectiveAddressId) {
                setOrderError("Please select a shipping address.");
                return;
              }
              setOrderError(null);
              setStep("payment");
            }}
            disabled={!effectiveAddressId}
          >
            Continue to Payment →
          </button>
          <Link
            href={"/app/cart" as any}
            className="block text-center text-sm text-forumo-link hover:underline"
          >
            ← Back to cart
          </Link>
        </div>
      </div>
    );
  }

  // --- Step 2: Payment ---
  const sellers = Array.from(groupedBySeller.entries());

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-[color:var(--ink-3)]">
          Checkout · Step 2 of 2
        </p>
        <h1 className="text-2xl font-bold">Payment</h1>
      </div>

      {orderError && (
        <div className="card-forumo border border-red-200 bg-red-50 space-y-1">
          <p className="text-sm text-red-600">{orderError}</p>
          <button
            type="button"
            onClick={() => setOrderError(null)}
            className="text-xs text-red-500 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Order summary sidebar */}
        <div className="lg:col-span-2 space-y-3">
          <p className="text-sm font-semibold text-[color:var(--ink)]">
            Order summary
          </p>
          {sellers.map(([sellerId, sellerItems]) => (
            <SellerSummaryCard
              key={sellerId}
              sellerId={sellerId}
              sellerItems={sellerItems}
              selectedRate={selectedRate}
            />
          ))}
        </div>

        {/* Payment action */}
        <div className="lg:col-span-3 space-y-3">
          <div className="card-forumo space-y-4">
            {isPaystack ? (
              <>
                <div className="flex items-center gap-2 text-xs text-[color:var(--ink-3)]">
                  <span className="px-2 py-1 bg-[#00c3f7]/10 text-[#00c3f7] rounded font-semibold tracking-wide">
                    Paystack
                  </span>
                  <span>Secure African payment</span>
                </div>
                <p className="text-sm text-[color:var(--ink-2)]">
                  You will be redirected to Paystack&apos;s secure checkout page
                  to complete your payment.
                </p>
                <button
                  type="button"
                  className="btn-forumo w-full py-3 font-bold"
                  onClick={placeOrders}
                  disabled={placingOrder}
                >
                  {placingOrder
                    ? "Redirecting to Paystack…"
                    : "Pay with Paystack"}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs text-[color:var(--ink-3)]">
                  <span className="px-2 py-1 bg-[#635BFF]/10 text-[#635BFF] rounded font-semibold tracking-wide">
                    Stripe
                  </span>
                  <span>Secure card payment</span>
                </div>
                <p className="text-sm text-[color:var(--ink-2)]">
                  Your order will be created and you&apos;ll enter your card
                  details to confirm payment.
                </p>
                <button
                  type="button"
                  className="btn-forumo w-full py-3 font-bold"
                  onClick={placeOrders}
                  disabled={placingOrder}
                >
                  {placingOrder ? "Creating order…" : "Confirm & Pay"}
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            className="text-sm text-forumo-link hover:underline"
            onClick={() => {
              setStep("shipping");
              setOrderError(null);
            }}
          >
            ← Back to shipping
          </button>
        </div>
      </div>
    </div>
  );
}
