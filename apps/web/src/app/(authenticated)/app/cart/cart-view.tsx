"use client";

import Link from "next/link";
import { useCart } from "../../../../lib/cart-context";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    cents / 100,
  );
}

export function CartView() {
  const {
    items,
    itemCount,
    totalCents,
    groupedBySeller,
    removeItem,
    updateQuantity,
    clearCart,
  } = useCart();

  if (itemCount === 0) {
    return (
      <div className="card-forumo text-center py-16 space-y-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-16 w-16 mx-auto text-[color:var(--ink-3)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <p className="text-slate-500 font-medium">Your cart is empty</p>
        <Link
          href="/listings"
          className="btn-forumo inline-block px-6 py-2 text-sm"
        >
          Browse listings
        </Link>
      </div>
    );
  }

  const currency = items[0]?.currency ?? "USD";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Shopping Cart ({itemCount} item{itemCount !== 1 ? "s" : ""})
        </h1>
        <button
          onClick={clearCart}
          className="text-sm text-red-500 hover:underline"
        >
          Clear cart
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Items grouped by seller */}
        <div className="lg:col-span-2 space-y-4">
          {Array.from(groupedBySeller.entries()).map(
            ([sellerId, sellerItems]) => (
              <div key={sellerId} className="card-forumo space-y-4">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                  Seller: {sellerItems[0]?.sellerName ?? sellerId.slice(0, 8)}
                </p>
                {sellerItems.map((item) => (
                  <div
                    key={`${item.listingId}:${item.variantId ?? ""}`}
                    className="flex gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0"
                  >
                    {/* Image */}
                    <div className="w-20 h-20 rounded bg-slate-100 flex-shrink-0 overflow-hidden">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[color:var(--ink-3)]">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/listings/${item.listingId}`}
                        className="text-sm font-medium hover:text-forumo-link line-clamp-2"
                      >
                        {item.title}
                      </Link>
                      {item.variantLabel && (
                        <p className="text-xs muted mt-0.5">
                          {item.variantLabel}
                        </p>
                      )}
                      <p className="text-base font-bold mt-1">
                        {formatPrice(item.priceCents, item.currency)}
                      </p>
                    </div>
                    {/* Quantity + Remove */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.listingId,
                              item.quantity - 1,
                              item.variantId,
                            )
                          }
                          className="w-7 h-7 flex items-center justify-center border border-slate-300 rounded hover:bg-slate-100 text-lg leading-none"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.listingId,
                              item.quantity + 1,
                              item.variantId,
                            )
                          }
                          className="w-7 h-7 flex items-center justify-center border border-slate-300 rounded hover:bg-slate-100 text-lg leading-none"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() =>
                          removeItem(item.listingId, item.variantId)
                        }
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                      <p className="text-sm font-semibold">
                        {formatPrice(
                          item.priceCents * item.quantity,
                          item.currency,
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ),
          )}
        </div>

        {/* Order Summary */}
        <div className="card-forumo h-fit space-y-3">
          <h2 className="text-lg font-bold">Order Summary</h2>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">
              Subtotal ({itemCount} item{itemCount !== 1 ? "s" : ""})
            </span>
            <span className="font-medium">
              {formatPrice(totalCents, currency)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Shipping</span>
            <span className="muted">Calculated at checkout</span>
          </div>
          <hr className="border-slate-200" />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatPrice(totalCents, currency)}</span>
          </div>
          <Link
            href="/app/checkout"
            className="btn-forumo block text-center w-full py-3 font-bold"
          >
            Proceed to Checkout
          </Link>
          <Link
            href="/listings"
            className="block text-center text-sm text-forumo-link hover:underline"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
