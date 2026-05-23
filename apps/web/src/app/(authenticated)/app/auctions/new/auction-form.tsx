'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useMyListings, useCreateAuction } from '../../../../../lib/react-query/hooks';
import type { SafeListing } from '@forumo/shared';

const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none';
const labelCls = 'mb-1 block text-sm font-medium text-slate-300';

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
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-slate-800" />)}
      </div>
    );
  }

  if (publishedListings.length === 0) {
    return (
      <div className="py-10 text-center space-y-3">
        <p className="text-slate-400">You have no published listings to auction.</p>
        <p className="text-sm text-slate-500">
          Publish a listing first, then come back to create an auction.
        </p>
        <a
          href="/app/listings/new"
          className="inline-block rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400"
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
        <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border border-slate-700 p-2">
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
          <p className="mt-1 text-xs text-emerald-400">Selected: {selected.title}</p>
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
        <p className="mt-1 text-xs text-slate-500">
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
          <p className="mt-1 text-xs text-slate-500">Minimum you'll accept. Not shown to buyers.</p>
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
          <p className="mt-1 text-xs text-slate-500">Allow immediate purchase at this price.</p>
        </div>
      </div>

      {/* Summary */}
      {selected && startingBid && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 space-y-1 text-sm">
          <p className="font-medium text-slate-300">Auction summary</p>
          <p className="text-slate-400">
            Item: <span className="text-white">{selected.title}</span>
          </p>
          <p className="text-slate-400">
            Starting bid: <span className="text-amber-400">
              {parseFloat(startingBid) > 0
                ? (parseFloat(startingBid)).toLocaleString('en-GH', { style: 'currency', currency: selected.currency ?? 'GHS' })
                : '—'}
            </span>
          </p>
          <p className="text-slate-400">
            Duration: <span className="text-white">{durationDays} day{parseInt(durationDays) > 1 ? 's' : ''}</span>
          </p>
          {buyNowPrice && (
            <p className="text-slate-400">
              Buy now: <span className="text-emerald-400">
                {parseFloat(buyNowPrice).toLocaleString('en-GH', { style: 'currency', currency: selected.currency ?? 'GHS' })}
              </span>
            </p>
          )}
        </div>
      )}

      {createAuction.isError && (
        <p className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-2 text-sm text-red-400">
          {(createAuction.error as Error)?.message ?? 'Failed to create auction. Please try again.'}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={createAuction.isPending || !selectedId || !startingBid}
          className="rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
        >
          {createAuction.isPending ? 'Creating…' : 'Start auction'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/auctions' as any)}
          className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
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
          ? 'border border-amber-500/50 bg-amber-500/10'
          : 'border border-transparent hover:bg-slate-800'
      }`}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-800">
        {listing.images?.[0]?.url ? (
          <Image src={listing.images[0].url} alt={listing.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-600 text-sm">📦</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{listing.title}</p>
        <p className="text-xs text-slate-500">
          {(listing.priceCents / 100).toLocaleString('en-GH', {
            style: 'currency',
            currency: listing.currency ?? 'GHS',
          })}
        </p>
      </div>
      {selected && <span className="text-amber-400 text-sm">✓</span>}
    </button>
  );
}
