'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useMyListings, useDeleteListing, useListingMutations } from '../../../../lib/react-query/hooks';
import type { SafeListing } from '@forumo/shared';

const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  DRAFT: 'text-slate-400 bg-slate-400/10 border-slate-600',
  PAUSED: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
};

const MODERATION_COLORS: Record<string, string> = {
  PENDING: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
  APPROVED: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  REJECTED: 'text-red-400 bg-red-400/10 border-red-400/20',
  FLAGGED: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
};

function ModerationBanner({ listing }: { listing: SafeListing }) {
  const mod = (listing as any).moderationStatus as string | undefined;
  if (!mod || mod === 'APPROVED') return null;

  if (mod === 'PENDING') {
    return (
      <div className={`mt-1.5 flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${MODERATION_COLORS.PENDING}`}>
        <span className="mt-px shrink-0">⏳</span>
        <span>
          <strong>Under review</strong> — Your listing is being reviewed by our team. It will go live once approved.
        </span>
      </div>
    );
  }

  if (mod === 'REJECTED') {
    const notes = (listing as any).moderationNotes as string | undefined;
    return (
      <div className={`mt-1.5 flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${MODERATION_COLORS.REJECTED}`}>
        <span className="mt-px shrink-0">🚫</span>
        <span>
          <strong>Review failed</strong>
          {notes ? ` — ${notes}` : ' — This listing did not pass our content review. Edit and resubmit to try again.'}
        </span>
      </div>
    );
  }

  if (mod === 'FLAGGED') {
    return (
      <div className={`mt-1.5 flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${MODERATION_COLORS.FLAGGED}`}>
        <span className="mt-px shrink-0">⚠️</span>
        <span>
          <strong>Flagged for review</strong> — This listing has been reported and is under investigation.
        </span>
      </div>
    );
  }

  return null;
}

export function ListingsManager() {
  const { data, isLoading } = useMyListings();
  const deleteListing = useDeleteListing();
  const { updateMutation } = useListingMutations();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const listings = data?.listings ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  async function handleDelete(id: string) {
    await deleteListing.mutateAsync(id);
    setConfirmDelete(null);
  }

  async function toggleStatus(listing: SafeListing) {
    const next = listing.status === 'PUBLISHED' ? 'PAUSED' : 'PUBLISHED';
    await updateMutation.mutateAsync({ id: listing.id, payload: { status: next as any } });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={'/app/listings/new' as any}
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
        >
          + New listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center">
          <p className="text-slate-400">You have no listings yet.</p>
          <Link
            href={'/app/listings/new' as any}
            className="mt-4 inline-block rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Create your first listing
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <div
              key={listing.id}
              className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
            >
              {/* Thumbnail */}
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                {listing.images?.[0]?.url ? (
                  <Image
                    src={listing.images[0].url}
                    alt={listing.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-slate-600">
                    📦
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{listing.title}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[listing.status] ?? STATUS_COLORS.DRAFT}`}
                  >
                    {listing.status}
                  </span>
                </div>
                <p className="text-sm text-slate-400">
                  {(listing.priceCents / 100).toLocaleString('en-GH', { style: 'currency', currency: listing.currency ?? 'GHS' })}
                  {listing.location && <span className="ml-2 text-slate-500">· {listing.location}</span>}
                </p>
                {listing.description && (
                  <p className="mt-0.5 text-xs text-slate-500 truncate">{listing.description}</p>
                )}
                <ModerationBanner listing={listing} />
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => toggleStatus(listing)}
                  disabled={
                    updateMutation.isPending ||
                    (listing as any).moderationStatus === 'PENDING'
                  }
                  className="rounded px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={
                    (listing as any).moderationStatus === 'PENDING'
                      ? 'Waiting for moderation approval'
                      : listing.status === 'PUBLISHED'
                      ? 'Pause listing'
                      : 'Publish listing'
                  }
                >
                  {listing.status === 'PUBLISHED' ? 'Pause' : 'Publish'}
                </button>
                <Link
                  href={`/app/listings/${listing.id}/edit` as any}
                  className="rounded px-2.5 py-1.5 text-xs text-amber-400 hover:bg-amber-400/10"
                >
                  Edit
                </Link>
                {confirmDelete === listing.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(listing.id)}
                      disabled={deleteListing.isPending}
                      className="rounded px-2.5 py-1.5 text-xs text-white bg-red-600 hover:bg-red-500 disabled:opacity-50"
                    >
                      {deleteListing.isPending ? '…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="rounded px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(listing.id)}
                    className="rounded px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-400/10"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
