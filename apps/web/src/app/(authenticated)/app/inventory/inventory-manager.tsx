'use client';

import { useState } from 'react';
import { useMyListings, useVariantInventory, useInventoryMutations } from '@/lib/react-query/hooks';
import type { SafeListing, ListingVariant } from '@forumo/shared';

// ---- Variant row with inline inventory controls ----
function VariantInventoryRow({ variant, listingId }: { variant: ListingVariant; listingId: string }) {
  const { data, isLoading } = useVariantInventory(variant.id ?? null);
  const { addStock, adjustStock } = useInventoryMutations(variant.id ?? '');

  const [mode, setMode] = useState<null | 'add' | 'adjust'>(null);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [location, setLocation] = useState('');

  const summary = data?.summary;

  function handleSubmit() {
    const num = parseInt(qty, 10);
    if (isNaN(num) || num === 0) return;
    if (mode === 'add') {
      addStock.mutate({ quantity: num, location: location || undefined }, {
        onSuccess: () => { setMode(null); setQty(''); setLocation(''); },
      });
    } else if (mode === 'adjust') {
      if (!reason.trim()) return;
      adjustStock.mutate({ adjustment: num, reason }, {
        onSuccess: () => { setMode(null); setQty(''); setReason(''); },
      });
    }
  }

  const stockColor =
    !summary ? 'text-slate-500' :
    summary.availableQuantity === 0 ? 'text-red-400' :
    summary.availableQuantity <= 5 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-sm">{variant.label || 'Default'}</span>
          {variant.sku && <span className="ml-2 text-xs text-slate-500">SKU: {variant.sku}</span>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          {isLoading ? (
            <span className="text-slate-500 text-xs">Loading…</span>
          ) : summary ? (
            <>
              <span className={`font-semibold ${stockColor}`}>{summary.availableQuantity} available</span>
              {summary.reservedQuantity > 0 && (
                <span className="text-blue-400">{summary.reservedQuantity} reserved</span>
              )}
              {summary.damagedQuantity > 0 && (
                <span className="text-red-400">{summary.damagedQuantity} damaged</span>
              )}
            </>
          ) : (
            <span className="text-slate-500 text-xs">No inventory data</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode(mode === 'add' ? null : 'add')}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800 transition-colors"
          >
            + Add Stock
          </button>
          <button
            onClick={() => setMode(mode === 'adjust' ? null : 'adjust')}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800 transition-colors"
          >
            Adjust
          </button>
        </div>
      </div>

      {mode && (
        <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-slate-800">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">{mode === 'adjust' ? 'Adjustment (±)' : 'Quantity'}</label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder={mode === 'adjust' ? '±10' : '100'}
            />
          </div>
          {mode === 'add' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Location (optional)</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-36 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Warehouse A"
              />
            </div>
          )}
          {mode === 'adjust' && (
            <div className="flex flex-col gap-1 flex-1 min-w-40">
              <label className="text-xs text-slate-400">Reason <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Shrinkage, correction…"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={addStock.isPending || adjustStock.isPending}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-1.5 text-sm font-medium transition-colors"
            >
              {addStock.isPending || adjustStock.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setMode(null); setQty(''); setReason(''); setLocation(''); }}
              className="rounded-lg border border-slate-700 hover:bg-slate-800 px-3 py-1.5 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
          {(addStock.isError || adjustStock.isError) && (
            <p className="text-red-400 text-xs w-full">Failed to update inventory. Please try again.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Listing card with collapsible variants ----
function ListingInventoryCard({ listing }: { listing: SafeListing }) {
  const [expanded, setExpanded] = useState(false);
  const variants = listing.variants ?? [];

  const totalAvailable = variants.reduce((s, v) => s + (v.inventoryCount ?? 0), 0);
  const stockColor =
    totalAvailable === 0 ? 'text-red-400' :
    totalAvailable <= 5 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
      <button
        className="w-full flex items-center gap-4 p-4 hover:bg-slate-900/40 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {listing.images?.[0]?.url ? (
          <img
            src={listing.images[0].url}
            alt={listing.title}
            className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
            <span className="text-slate-500 text-xs">No img</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{listing.title}</p>
          <p className="text-xs text-slate-400">{variants.length} variant{variants.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <span className={`text-sm font-semibold ${stockColor}`}>{totalAvailable} in stock</span>
          <span className="text-slate-500 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-slate-800 pt-4">
          {variants.length === 0 ? (
            <p className="text-sm text-slate-500">No variants. Add variants to your listing to track inventory.</p>
          ) : (
            variants.map((v) => (
              <VariantInventoryRow key={v.id} variant={v} listingId={listing.id} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main page component ----
export function InventoryManager() {
  const { data, isLoading, isError } = useMyListings();
  const [search, setSearch] = useState('');

  const listings = (data?.listings ?? []).filter((l) =>
    l.title.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-slate-900 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-900 bg-red-950/30 p-6 text-red-400 text-sm">
        Failed to load your listings. Please refresh.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search listings…"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <span className="text-sm text-slate-400">{listings.length} listing{listings.length !== 1 ? 's' : ''}</span>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-10 text-center text-slate-500">
          {search ? 'No listings match your search.' : 'You have no listings yet.'}
        </div>
      ) : (
        listings.map((listing) => (
          <ListingInventoryCard key={listing.id} listing={listing} />
        ))
      )}
    </div>
  );
}
