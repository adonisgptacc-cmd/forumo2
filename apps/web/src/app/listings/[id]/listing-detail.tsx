'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';

import { useCurrentUser, useListing, useListingReviews, useReviewMutations, useCreateOffer, useWishlistCheck, useSaveListing, useRemoveSavedListing, useSellerStorefront, useListingMutations, useCreateThread } from '../../../lib/react-query/hooks';
import { useCart } from '../../../lib/cart-context';

export function ListingDetail({ id }: { id: string }) {
  const { data, isLoading } = useListing(id);
  const { user } = useCurrentUser();
  const { data: sellerStorefront } = useSellerStorefront(data?.sellerId ?? null);
  const { addItem } = useCart();
  const router = useRouter();
  const { data: reviewData, isLoading: reviewsLoading } = useListingReviews(id);
  const { createReview } = useReviewMutations();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [orderId, setOrderId] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const createOffer = useCreateOffer();
  const { reportListingMutation } = useListingMutations();
  const { data: wishlistCheck } = useWishlistCheck(user ? (data?.id ?? null) : null);
  const saveListing = useSaveListing();
  const removeSaved = useRemoveSavedListing();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Prohibited item');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageBody, setMessageBody] = useState('');
  const createThread = useCreateThread();
  const isSaved = wishlistCheck?.saved ?? false;

  const isSubmitting = createReview.isPending;

  const averageRating = useMemo(() => {
    if (!reviewData) return '—';
    return reviewData.rollup.publishedCount > 0 ? reviewData.rollup.averageRating.toFixed(1) : '—';
  }, [reviewData]);

  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <div className="card-forumo animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-slate-200 rounded" />
            <div className="space-y-4">
              <div className="h-8 bg-slate-200 rounded w-3/4" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
              <div className="h-10 bg-slate-200 rounded w-1/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-6">
        <div className="card-forumo text-center py-16 space-y-3">
          <p className="text-slate-500 font-medium">Listing not found</p>
          <Link className="text-forumo-link hover:underline" href="/listings">
            Back to listings
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data || !user) return;
    createReview.mutate({
      reviewerId: user.id,
      recipientId: data.sellerId,
      listingId: data.id,
      orderId,
      rating,
      comment,
    });
  };

  const images = data.images ?? [];

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Breadcrumb */}
      <div className="text-sm text-slate-500">
        <Link href="/listings" className="text-forumo-link hover:underline">Listings</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">{data.title}</span>
      </div>

      {/* Main Product Card */}
      <div className="card-forumo">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-3">
            <div className="relative aspect-square bg-slate-100 rounded overflow-hidden">
              {images.length > 0 && images[selectedImage]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={images[selectedImage].url}
                  alt={data.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded border-2 overflow-hidden flex-shrink-0 ${
                      i === selectedImage ? 'border-forumo-orange' : 'border-slate-200'
                    }`}
                  >
                    {img.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-100" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase tracking-wide text-slate-400 font-medium">{data.status}</span>
              <div className="flex items-start justify-between gap-3 mt-1">
                <h1 className="text-2xl font-bold">{data.title}</h1>
                {user && user.id !== data.sellerId && (
                  <button
                    type="button"
                    onClick={() => isSaved ? removeSaved.mutate(data.id) : saveListing.mutate(data.id)}
                    disabled={saveListing.isPending || removeSaved.isPending}
                    title={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
                    className={`shrink-0 text-2xl transition-colors disabled:opacity-50 ${isSaved ? 'text-red-500' : 'text-slate-400 hover:text-red-400'}`}
                  >
                    {isSaved ? '♥' : '♡'}
                  </button>
                )}
              </div>
            </div>

            {/* Rating summary */}
            {reviewData && reviewData.rollup.publishedCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-forumo-orange font-bold">{averageRating}</span>
                <span className="text-forumo-orange">{'★'.repeat(Math.round(reviewData.rollup.averageRating))}</span>
                <span className="text-slate-500">({reviewData.rollup.publishedCount} reviews)</span>
              </div>
            )}

            <hr className="border-slate-200" />

            <div>
              <p className="text-3xl font-bold">{formatPrice(data.priceCents, data.currency ?? 'USD')}</p>
              {data.location && (
                <p className="text-sm text-slate-500 mt-1">Ships from {data.location}</p>
              )}
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">{data.description}</p>

            {/* Variants */}
            {data.variants && data.variants.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Options:</p>
                <div className="flex flex-wrap gap-2">
                  {data.variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariantId(variant.id === selectedVariantId ? null : (variant.id ?? null))}
                      className={`px-3 py-2 border rounded text-sm transition-colors ${
                        selectedVariantId === variant.id
                          ? 'border-forumo-orange bg-forumo-orange/10 text-forumo-orange font-medium'
                          : 'border-slate-300 hover:border-forumo-orange'
                      }`}
                    >
                      {variant.label} — {formatPrice(variant.priceCents, variant.currency ?? data.currency ?? 'USD')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="button"
                className="btn-forumo block text-center w-full py-3 text-lg font-bold"
                onClick={() => {
                  const selectedVariant = selectedVariantId
                    ? (data.variants?.find((v) => v.id === selectedVariantId) ?? null)
                    : null;
                  addItem({
                    listingId: data.id,
                    sellerId: data.sellerId,
                    title: data.title,
                    priceCents: selectedVariant?.priceCents ?? data.priceCents,
                    currency: selectedVariant?.currency ?? data.currency ?? 'USD',
                    imageUrl: data.images?.[0]?.url,
                    variantId: selectedVariant?.id ?? undefined,
                    variantLabel: selectedVariant?.label ?? undefined,
                  });
                  setAddedToCart(true);
                  setTimeout(() => setAddedToCart(false), 2000);
                }}
              >
                {addedToCart ? '✓ Added to Cart' : 'Add to Cart'}
              </button>
              <button
                type="button"
                className="block text-center w-full py-3 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 font-medium"
                onClick={() => {
                  const selectedVariant = selectedVariantId
                    ? (data.variants?.find((v) => v.id === selectedVariantId) ?? null)
                    : null;
                  addItem({
                    listingId: data.id,
                    sellerId: data.sellerId,
                    title: data.title,
                    priceCents: selectedVariant?.priceCents ?? data.priceCents,
                    currency: selectedVariant?.currency ?? data.currency ?? 'USD',
                    imageUrl: data.images?.[0]?.url,
                    variantId: selectedVariant?.id ?? undefined,
                    variantLabel: selectedVariant?.label ?? undefined,
                  });
                  router.push('/app/checkout');
                }}
              >
                Buy Now
              </button>
              {user && user.id !== data.sellerId && (
                <button
                  type="button"
                  onClick={() => setShowOfferModal(true)}
                  className="block text-center w-full py-3 border border-amber-400 rounded-lg text-sm text-amber-400 hover:bg-amber-400/10 font-medium"
                >
                  Make an offer
                </button>
              )}
              {user && user.id !== data.sellerId && (
                <button
                  type="button"
                  onClick={() => setShowMessageModal(true)}
                  className="block text-center w-full py-3 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                >
                  Contact Seller
                </button>
              )}
              {sellerStorefront?.slug && (
                <Link
                  href={`/shops/${sellerStorefront.slug}` as any}
                  className="block text-center w-full py-3 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                >
                  View seller&apos;s shop →
                </Link>
              )}
            </div>

            {/* Contact Seller modal */}
            {showMessageModal && user && data && user.id !== data.sellerId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
                <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950 p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Message seller</h3>
                  <p className="text-sm text-slate-400 truncate">{data.title}</p>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-300">Message</label>
                    <textarea
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      placeholder="Hi, I have a question about this listing…"
                      rows={4}
                      maxLength={2000}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  {createThread.isError && (
                    <p className="text-sm text-red-400">{(createThread.error as Error)?.message}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        const thread = await createThread.mutateAsync({
                          listingId: data.id,
                          subject: `Re: ${data.title.slice(0, 100)}`,
                          participants: [
                            { userId: user.id, role: 'BUYER' },
                            { userId: data.sellerId, role: 'SELLER' },
                          ],
                          initialMessage: messageBody.trim()
                            ? { authorId: user.id, body: messageBody.trim() }
                            : undefined,
                        });
                        setShowMessageModal(false);
                        setMessageBody('');
                        createThread.reset();
                        router.push(`/app/messages/${thread.id}` as any);
                      }}
                      disabled={createThread.isPending}
                      className="flex-1 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
                    >
                      {createThread.isPending ? 'Starting…' : 'Start conversation'}
                    </button>
                    <button
                      onClick={() => { setShowMessageModal(false); setMessageBody(''); createThread.reset(); }}
                      className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Report listing — only for logged-in non-owners */}
            {user && user.id !== data.sellerId && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="text-xs text-slate-400 hover:text-red-400 hover:underline"
                >
                  Report this listing
                </button>
              </div>
            )}

            {/* Report modal */}
            {showReportModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
                <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950 p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Report listing</h3>
                  <p className="text-sm text-slate-400">
                    Tell us why this listing violates Forumo&apos;s policies. Our team will review it.
                  </p>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-300">Reason</label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                    >
                      <option>Prohibited item</option>
                      <option>Counterfeit / fake product</option>
                      <option>Misleading description</option>
                      <option>Spam or duplicate listing</option>
                      <option>Offensive content</option>
                      <option>Suspected scam</option>
                      <option>Other</option>
                    </select>
                  </div>
                  {reportListingMutation.isError && (
                    <p className="text-sm text-red-400">{(reportListingMutation.error as Error)?.message}</p>
                  )}
                  {reportListingMutation.isSuccess && (
                    <p className="text-sm text-emerald-400">Thanks — our team will review this listing.</p>
                  )}
                  <div className="flex gap-3">
                    {!reportListingMutation.isSuccess && (
                      <button
                        onClick={async () => {
                          await reportListingMutation.mutateAsync({ listingId: data.id, reason: reportReason });
                          setTimeout(() => { setShowReportModal(false); reportListingMutation.reset(); }, 1800);
                        }}
                        disabled={reportListingMutation.isPending}
                        className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        {reportListingMutation.isPending ? 'Submitting…' : 'Submit report'}
                      </button>
                    )}
                    <button
                      onClick={() => { setShowReportModal(false); reportListingMutation.reset(); }}
                      className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      {reportListingMutation.isSuccess ? 'Close' : 'Cancel'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Make an offer modal */}
            {showOfferModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
                <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950 p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Make an offer</h3>
                  <p className="text-sm text-slate-400">
                    Listed at {(data.priceCents / 100).toFixed(2)} {data.currency}
                  </p>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-300">Your offer ({data.currency})</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-300">Message (optional)</label>
                    <textarea
                      value={offerMessage}
                      onChange={(e) => setOfferMessage(e.target.value)}
                      placeholder="Why are you making this offer?"
                      rows={3}
                      maxLength={500}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  {createOffer.isError && (
                    <p className="text-sm text-red-400">{(createOffer.error as Error)?.message}</p>
                  )}
                  {createOffer.isSuccess && (
                    <p className="text-sm text-emerald-400">Offer sent! View it in your offers page.</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        if (!offerAmount) return;
                        const amountCents = Math.round(parseFloat(offerAmount) * 100);
                        await createOffer.mutateAsync({
                          listingId: data.id,
                          amountCents,
                          message: offerMessage || undefined,
                        });
                        setTimeout(() => setShowOfferModal(false), 1500);
                      }}
                      disabled={createOffer.isPending || !offerAmount}
                      className="flex-1 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
                    >
                      {createOffer.isPending ? 'Sending…' : 'Send offer'}
                    </button>
                    <button
                      onClick={() => { setShowOfferModal(false); createOffer.reset(); }}
                      className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <Link className="text-sm text-forumo-link hover:underline" href={`/listings/${data.id}/edit`}>
              Edit this listing
            </Link>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="card-forumo space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Customer Reviews</h2>
            <p className="text-sm text-slate-500">
              {averageRating} out of 5 ({reviewData?.rollup.publishedCount ?? 0} reviews)
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Review list */}
          <div className="space-y-3">
            {reviewsLoading && <p className="text-sm text-slate-500">Loading reviews...</p>}
            {!reviewsLoading && (reviewData?.reviews?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">No reviews yet. Be the first!</p>
            ) : null}
            <ul className="space-y-3">
              {reviewData?.reviews.map((review) => (
                <li key={review.id} className="border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-forumo-orange font-bold">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                    <span className="font-medium">{review.reviewer?.name ?? 'Anonymous'}</span>
                  </div>
                  {review.comment ? (
                    <p className="text-sm text-slate-600 mt-1">{review.comment}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">No comment</p>
                  )}
                  {review.flags.length > 0 && (
                    <p className="text-xs text-amber-600 mt-1">Under review</p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Review form */}
          <div>
            <h3 className="text-lg font-bold mb-3">Leave a review</h3>
            {!user ? (
              <div className="text-center py-8 bg-slate-50 rounded">
                <p className="text-sm text-slate-500">Sign in to leave a review</p>
                <Link href="/login" className="btn-forumo inline-block mt-2 text-sm">Sign in</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Rating</span>
                  <select
                    className="input-forumo mt-1"
                    value={rating}
                    onChange={(event) => setRating(Number(event.target.value))}
                    disabled={isSubmitting}
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>{value} star{value !== 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Order ID</span>
                  <input
                    className="input-forumo mt-1"
                    required
                    value={orderId}
                    onChange={(event) => setOrderId(event.target.value)}
                    placeholder="Your order ID"
                    disabled={isSubmitting}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Comment</span>
                  <textarea
                    className="input-forumo mt-1"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    rows={4}
                    disabled={isSubmitting}
                    placeholder="Share your experience"
                  />
                </label>

                <button
                  type="submit"
                  className="btn-forumo w-full py-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit review'}
                </button>
                {createReview.error ? (
                  <p className="text-sm text-red-600">{String(createReview.error.message)}</p>
                ) : null}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(priceCents / 100);
}
