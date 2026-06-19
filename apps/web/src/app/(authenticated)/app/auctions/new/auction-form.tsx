'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useMyListings, useCreateAuction } from '../../../../../lib/react-query/hooks';
import type { SafeListing } from '@forumo/shared';

const inputCls =
  'w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]';
const labelCls = 'mb-1 block text-sm font-medium text-[color:var(--ink-2)]';

export function AuctionForm() {
  const router = useRouter();
  const { data, isLoading } = useMyListings();
  const createAuction = useCreateAuction();

  const [selectedId, setSelectedId] = useState('');
  const [startingBid, setStartingBid] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [reservePrice, setReservePrice] = useState('');
  const [buyNowPrice, setBuyNowPrice] = useState('');

  const publishedListings = (data?.data ?? []).filter((l: SafeListing) => l.status === 'PUBLISHED');
  const selected = publishedListings.find((l: SafeListing) => l.id === selectedId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;

    const startingBidCents = Math.round(parseFloat(startingBid) * 100);
    if (isNaN(startingBidCents) || startingBidCents < 0) return;

    const payload = {
      listingId: selectedId,
      startingBidCents,
      durationDays: parseInt(durationDays, 10),
      ...(reservePrice ? { reserveCents: Math.round(parseFloat(reservePrice) * 100) } : {}),
      ...(buyNowPrice ? { buyNowCents: Math.round(parseFloat(buyNowPrice) * 100) } : {}),
    };

    await createAuction.mutateAsync(payload);
    router.push('/auctions' as any);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12" />)}
      </div>
    );
  }

  if (publishedListings.length === 0) {
    return (
      <div className="py-10 text-center space-y-3">
        <p className="text-[color:var(--ink-3)]">You have no published listings to auction.</p>
        <p className="text-sm text-[color:var(--ink-3)]">
          Publish a listing first, then come back to create an auction.
        </p>
        <a
          href="/app/listings/new"
          className="btn btn-primary inline-flex"
        >
          Create a listing
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Listing picker */}
      <div>
        <label className={labelCls}>Select listing *</label>
        <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border border-[color:var(--line-2)] p-2">
          {publishedListings.map((listing) => (
            <ListingOption
              key={listing.id}
              listing={listing}
              selected={selectedId === listing.id}
              onSelect={() => setSelectedId(listing.id)}
            />
          ))}
        </div>
        {selected && (
          <p className="mt-1 text-xs text-[color:var(--escrow)]">Selected: {selected.title}</p>
        )}
      </div>

      {/* Starting bid */}
      <div>
        <label className={labelCls}>Starting bid *</label>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={startingBid}
          onChange={(e) => setStartingBid(e.target.value)}
          placeholder="0.00"
          className={inputCls}
        />
        <p className="mt-1 text-xs text-[color:var(--ink-3)]">
          The minimum first bid buyers must place.
        </p>
      </div>

      {/* Duration */}
      <div>
        <label className={labelCls}>Duration</label>
        <select
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value)}
          className={inputCls}
        >
          {[1, 3, 5, 7, 10, 14].map((d) => (
            <option key={d} value={d}>
              {d} day{d > 1 ? 's' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Reserve & Buy Now (optional) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Reserve price</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={reservePrice}
            onChange={(e) => setReservePrice(e.target.value)}
            placeholder="Optional"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-[color:var(--ink-3)]">Minimum you&apos;ll accept. Not shown to buyers.</p>
        </div>
        <div>
          <label className={labelCls}>Buy now price</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={buyNowPrice}
            onChange={(e) => setBuyNowPrice(e.target.value)}
            placeholder="Optional"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-[color:var(--ink-3)]">Allow immediate purchase at this price.</p>
        </div>
      </div>

      {/* Summary */}
      {selected && startingBid && (
        <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)] p-4 space-y-1 text-sm">
          <p className="font-medium text-[color:var(--ink-2)]">Auction summary</p>
          <p className="text-[color:var(--ink-3)]">
            Item: <span className="text-[color:var(--ink)]">{selected.title}</span>
          </p>
          <p className="text-[color:var(--ink-3)]">
            Starting bid: <span className="text-[color:var(--accent)]">
              {parseFloat(startingBid) > 0
                ? (parseFloat(startingBid)).toLocaleString('en-GH', { style: 'currency', currency: selected.currency ?? 'GHS' })
                : '—'}
            </span>
          </p>
          <p className="text-[color:var(--ink-3)]">
            Duration: <span className="text-[color:var(--ink)]">{durationDays} day{parseInt(durationDays) > 1 ? 's' : ''}</span>
          </p>
          {buyNowPrice && (
            <p className="text-[color:var(--ink-3)]">
              Buy now: <span className="text-[color:var(--escrow)]">
                {parseFloat(buyNowPrice).toLocaleString('en-GH', { style: 'currency', currency: selected.currency ?? 'GHS' })}
              </span>
            </p>
          )}
        </div>
      )}

      {createAuction.isError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {(createAuction.error as Error)?.message ?? 'Failed to create auction. Please try again.'}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={createAuction.isPending || !selectedId || !startingBid}
          className="btn btn-primary"
        >
          {createAuction.isPending ? 'Creating…' : 'Start auction'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/auctions' as any)}
          className="rounded-lg border border-[color:var(--line-2)] px-4 py-2.5 text-sm text-[color:var(--ink-2)] hover:bg-[color:var(--surface-2)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ListingOption({
  listing,
  selected,
  onSelect,
}: {
  listing: SafeListing;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        selected
          ? 'border border-[color:var(--accent)] bg-[color:var(--accent-bg)]'
          : 'border border-transparent hover:bg-[color:var(--surface-2)]'
      }`}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[color:var(--surface-2)]">
        {listing.images?.[0]?.url ? (
          <Image src={listing.images[0].url} alt={listing.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[color:var(--ink-3)] text-sm">📦</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[color:var(--ink)] truncate">{listing.title}</p>
        <p className="text-xs text-[color:var(--ink-3)]">
          {(listing.priceCents / 100).toLocaleString('en-GH', {
            style: 'currency',
            currency: listing.currency ?? 'GHS',
          })}
        </p>
      </div>
      {selected && <span className="text-[color:var(--accent)] text-sm">✓</span>}
    </button>
  );
}
