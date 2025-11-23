'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

import { useCurrentUser, useListing, useListingReviews, useReviewMutations } from '../../../lib/react-query/hooks';

export function ListingDetail({ id }: { id: string }) {
  const { data, isLoading } = useListing(id);
  const { user } = useCurrentUser();
  const { data: reviewData, isLoading: reviewsLoading } = useListingReviews(id);
  const { createReview } = useReviewMutations();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [orderId, setOrderId] = useState('');

  const isSubmitting = createReview.isPending;

  const averageRating = useMemo(() => {
    if (!reviewData) return '—';
    return reviewData.rollup.publishedCount > 0 ? reviewData.rollup.averageRating.toFixed(1) : '—';
  }, [reviewData]);

  if (isLoading) {
    return <p className="text-slate-400">Loading listing…</p>;
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <p className="text-slate-400">Listing not found or API unavailable.</p>
        <Link className="text-amber-300" href="/listings">
          ← Back to listings
        </Link>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-amber-300" href="/listings">
          ← Back to listings
        </Link>
        <Link className="text-sm text-amber-200 underline decoration-dotted underline-offset-4" href={`/listings/${data.id}/edit`}>
          Edit listing
        </Link>
      </div>
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{data.status}</p>
        <h1 className="text-4xl font-semibold">{data.title}</h1>
        <p className="text-slate-300">{data.description}</p>
        <p className="text-xl font-semibold">{formatPrice(data.priceCents, data.currency ?? 'USD')}</p>
        {data.location ? <p className="text-sm text-slate-400">Ships from {data.location}</p> : null}
      </section>

      {data.variants && data.variants.length > 0 ? (
        <section className="grid-card space-y-3">
          <h2 className="text-2xl">Variants</h2>
          <ul className="space-y-2">
            {data.variants.map((variant) => (
              <li key={variant.id} className="flex items-center justify-between text-sm">
                <span>{variant.label}</span>
                <span className="font-semibold">{formatPrice(variant.priceCents, variant.currency ?? data.currency ?? 'USD')}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.images && data.images.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-2xl">Images</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.images.map((image) => (
              <div key={image.id} className="rounded-xl border border-slate-800 p-2">
                {image.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt={data.title} className="h-48 w-full rounded-lg object-cover" />
                ) : (
                  <p className="text-xs text-slate-500">Image ready once uploaded.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-6 rounded-xl border border-slate-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Seller feedback</p>
            <p className="text-xl font-semibold">
              Average: {averageRating}{' '}
              <span className="text-sm text-slate-400">
                ({reviewData?.rollup.publishedCount ?? 0} published)
              </span>
            </p>
          </div>
          <div className="text-right text-sm text-slate-400">
            <p>Pending: {reviewData?.rollup.pendingCount ?? 0}</p>
            <p>Flags: {reviewData?.rollup.flaggedCount ?? 0}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Reviews</h3>
            {reviewsLoading && <p className="text-sm text-slate-500">Loading reviews…</p>}
            {!reviewsLoading && (reviewData?.reviews?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">No reviews yet.</p>
            ) : null}
            <ul className="space-y-3">
              {reviewData?.reviews.map((review) => (
                <li key={review.id} className="rounded-lg border border-slate-800 p-3">
                  <p className="text-sm font-semibold">{review.rating} / 5</p>
                  {review.comment ? (
                    <p className="text-sm text-slate-200">{review.comment}</p>
                  ) : (
                    <p className="text-xs text-slate-500">No comment provided.</p>
                  )}
                  <p className="text-xs text-slate-500">By {review.reviewer?.name ?? 'anonymous'}</p>
                  {review.flags.length > 0 ? (
                    <p className="text-xs text-amber-300">Held for review ({review.flags.length} flag)</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Leave a review</h3>
            {!user ? (
              <p className="text-sm text-slate-500">Sign in to submit feedback.</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block text-sm font-medium" htmlFor="rating">
                  Rating
                </label>
                <select
                  id="rating"
                  className="w-full rounded-md border border-slate-800 bg-slate-900 p-2"
                  value={rating}
                  onChange={(event) => setRating(Number(event.target.value))}
                  disabled={isSubmitting}
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} stars
                    </option>
                  ))}
                </select>

                <label className="block text-sm font-medium" htmlFor="orderId">
                  Order ID
                </label>
                <input
                  id="orderId"
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-900 p-2 text-sm"
                  value={orderId}
                  onChange={(event) => setOrderId(event.target.value)}
                  placeholder="Order used for this purchase"
                  disabled={isSubmitting}
                />

                <label className="block text-sm font-medium" htmlFor="comment">
                  Comment
                </label>
                <textarea
                  id="comment"
                  className="w-full rounded-md border border-slate-800 bg-slate-900 p-2 text-sm"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={4}
                  disabled={isSubmitting}
                  placeholder="Share details about this listing and seller"
                />

                <button
                  type="submit"
                  className="w-full rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting…' : 'Submit review'}
                </button>
                {createReview.error ? (
                  <p className="text-sm text-rose-300">{String(createReview.error.message)}</p>
                ) : null}
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(priceCents / 100);
}
