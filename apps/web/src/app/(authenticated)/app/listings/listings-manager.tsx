'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useMyListings, useDeleteListing, useListingMutations, useBulkListingOperations } from '../../../../lib/react-query/hooks';
import type { SafeListing } from '@forumo/shared';

const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  DRAFT: 'text-[color:var(--ink-3)] bg-[color:var(--surface-2)] border-[color:var(--line)]',
  PAUSED: 'text-amber-700 bg-amber-50 border-amber-200',
};

const MODERATION_COLORS: Record<string, string> = {
  PENDING: 'text-amber-700 bg-amber-50 border-amber-200',
  APPROVED: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  REJECTED: 'text-red-700 bg-red-50 border-red-200',
  FLAGGED: 'text-orange-700 bg-orange-50 border-orange-200',
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
  const { bulkPublish, bulkPause, bulkDelete } = useBulkListingOperations();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const listings = data?.data ?? [];
  const allIds = listings.map((l: { id: string }) => l.id);
  const allSelected = allIds.length > 0 && allIds.every((id: string) => selected.has(id));
  const anySelected = selected.size > 0;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function clearSelection() {
    setSelected(new Set());
    setConfirmBulkDelete(false);
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  async function handleDelete(id: string) {
    await deleteListing.mutateAsync(id);
    setConfirmDelete(null);
  }

  async function changeStatus(listing: SafeListing, next: 'PUBLISHED' | 'PAUSED') {
    await updateMutation.mutateAsync({ id: listing.id, payload: { status: next as any } });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={'/app/listings/new' as any}
          className="btn btn-primary"
        >
          + New listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--line-2)] p-12 text-center">
          <p className="text-[color:var(--ink-3)]">You have no listings yet.</p>
          <Link
            href={'/app/listings/new' as any}
            className="btn btn-primary mt-4 inline-flex"
          >
            Create your first listing
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Bulk action bar */}
          {anySelected && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-sm text-amber-800 font-medium mr-2">{selected.size} selected</span>
              <button
                onClick={async () => { await bulkPublish.mutateAsync([...selected]); clearSelection(); }}
                disabled={bulkPublish.isPending}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {bulkPublish.isPending ? '…' : 'Publish'}
              </button>
              <button
                onClick={async () => { await bulkPause.mutateAsync([...selected]); clearSelection(); }}
                disabled={bulkPause.isPending}
                className="rounded-lg bg-[color:var(--ink)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[oklch(0.30_0.012_50)] disabled:opacity-50"
              >
                {bulkPause.isPending ? '…' : 'Pause'}
              </button>
              {!confirmBulkDelete ? (
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Delete
                </button>
              ) : (
                <>
                  <button
                    onClick={async () => { await bulkDelete.mutateAsync([...selected]); clearSelection(); }}
                    disabled={bulkDelete.isPending}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {bulkDelete.isPending ? '…' : 'Confirm delete'}
                  </button>
                  <button onClick={() => setConfirmBulkDelete(false)} className="text-xs text-[color:var(--ink-3)] hover:text-[color:var(--ink)]">
                    Cancel
                  </button>
                </>
              )}
              <button onClick={clearSelection} className="ml-auto text-xs text-[color:var(--ink-3)] hover:text-[color:var(--ink-2)]">
                Clear selection
              </button>
            </div>
          )}

          {/* Select all header */}
          {listings.length > 1 && (
            <div className="flex items-center gap-3 px-1">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-[color:var(--line-2)] accent-[var(--accent)] cursor-pointer"
                aria-label="Select all listings"
              />
              <span className="text-xs text-[color:var(--ink-3)]">Select all</span>
            </div>
          )}

          {listings.map((listing) => (
            <div
              key={listing.id}
              className="flex items-center gap-4 rounded-xl card p-4"
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selected.has(listing.id)}
                onChange={() => toggleOne(listing.id)}
                className="h-4 w-4 shrink-0 rounded border-[color:var(--line-2)] accent-[var(--accent)] cursor-pointer"
                aria-label={`Select ${listing.title}`}
              />

              {/* Thumbnail */}
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[color:var(--surface-2)]">
                {listing.images?.[0]?.url ? (
                  <Image
                    src={listing.images[0].url}
                    alt={listing.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-[color:var(--ink-3)]">
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
                <p className="text-sm text-[color:var(--ink-3)]">
                  {(listing.priceCents / 100).toLocaleString('en-GH', { style: 'currency', currency: listing.currency ?? 'GHS' })}
                  {listing.location && <span className="ml-2 text-[color:var(--ink-3)]">· {listing.location}</span>}
                </p>
                {listing.description && (
                  <p className="mt-0.5 text-xs text-[color:var(--ink-3)] truncate">{listing.description}</p>
                )}
                <ModerationBanner listing={listing} />
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                {listing.status === 'DRAFT' && (
                  <button
                    onClick={() => changeStatus(listing, 'PUBLISHED')}
                    disabled={updateMutation.isPending || (listing as any).moderationStatus === 'PENDING'}
                    title={(listing as any).moderationStatus === 'PENDING' ? 'Waiting for moderation approval' : 'Publish listing'}
                    className="rounded px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {updateMutation.isPending ? '…' : 'Publish'}
                  </button>
                )}
                {listing.status === 'PUBLISHED' && (
                  <button
                    onClick={() => changeStatus(listing, 'PAUSED')}
                    disabled={updateMutation.isPending}
                    title="Pause listing"
                    className="rounded px-2.5 py-1.5 text-xs text-[color:var(--ink-2)] hover:bg-[color:var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {updateMutation.isPending ? '…' : 'Pause'}
                  </button>
                )}
                {listing.status === 'PAUSED' && (
                  <button
                    onClick={() => changeStatus(listing, 'PUBLISHED')}
                    disabled={updateMutation.isPending}
                    title="Republish listing"
                    className="rounded px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {updateMutation.isPending ? '…' : 'Republish'}
                  </button>
                )}
                <Link
                  href={`/app/listings/${listing.id}/edit` as any}
                  className="rounded px-2.5 py-1.5 text-xs text-[color:var(--accent)] hover:bg-amber-50"
                >
                  Edit
                </Link>
                {confirmDelete === listing.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(listing.id)}
                      disabled={deleteListing.isPending}
                      className="rounded px-2.5 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleteListing.isPending ? '…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="rounded px-2.5 py-1.5 text-xs text-[color:var(--ink-3)] hover:bg-[color:var(--surface-2)]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(listing.id)}
                    className="rounded px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
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
