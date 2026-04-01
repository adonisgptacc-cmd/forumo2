'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  useListingMutations,
  useCategories,
  useTags,
} from '../../../../lib/react-query/hooks';
import type { SafeListing } from '@forumo/shared';

interface Props {
  /** When provided, the form is in edit mode */
  listing?: SafeListing;
}

export function ListingForm({ listing }: Props) {
  const router = useRouter();
  const { createMutation, updateMutation } = useListingMutations();
  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();

  const isEdit = !!listing;
  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;
  const error = isEdit ? updateMutation.error : createMutation.error;

  // Form fields
  const [title, setTitle] = useState(listing?.title ?? '');
  const [description, setDescription] = useState(listing?.description ?? '');
  const [priceCents, setPriceCents] = useState(
    listing ? (listing.priceCents / 100).toFixed(2) : '',
  );
  const [currency, setCurrency] = useState(listing?.currency ?? 'GHS');
  const [location, setLocation] = useState(listing?.location ?? '');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>(
    (listing?.status as 'DRAFT' | 'PUBLISHED') ?? 'DRAFT',
  );

  // Variants
  const [variants, setVariants] = useState<
    { label: string; priceCents: string }[]
  >(
    listing?.variants?.map((v) => ({
      label: v.label,
      priceCents: (v.priceCents / 100).toFixed(2),
    })) ?? [],
  );

  useEffect(() => {
    if (listing) {
      setTitle(listing.title);
      setDescription(listing.description);
      setPriceCents((listing.priceCents / 100).toFixed(2));
      setCurrency(listing.currency ?? 'GHS');
      setLocation(listing.location ?? '');
      setStatus((listing.status as 'DRAFT' | 'PUBLISHED') ?? 'DRAFT');
      setVariants(
        listing.variants?.map((v) => ({
          label: v.label,
          priceCents: (v.priceCents / 100).toFixed(2),
        })) ?? [],
      );
    }
  }, [listing]);

  function addVariant() {
    setVariants((prev) => [...prev, { label: '', priceCents: '' }]);
  }

  function removeVariant(idx: number) {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateVariant(idx: number, field: 'label' | 'priceCents', value: string) {
    setVariants((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsedPrice = Math.round(parseFloat(priceCents) * 100);
    if (isNaN(parsedPrice) || parsedPrice <= 0) return;

    const payload = {
      title: title.trim(),
      description: description.trim(),
      priceCents: parsedPrice,
      currency: currency || undefined,
      location: location.trim() || undefined,
      status,
      variants: variants
        .filter((v) => v.label.trim())
        .map((v) => ({
          label: v.label.trim(),
          priceCents: Math.round(parseFloat(v.priceCents) * 100) || parsedPrice,
        })),
    };

    if (isEdit && listing) {
      await updateMutation.mutateAsync({ id: listing.id, payload });
      router.push('/app/listings' as any);
    } else {
      await createMutation.mutateAsync(payload);
      router.push('/app/listings' as any);
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none';
  const labelCls = 'mb-1 block text-sm font-medium text-slate-300';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className={labelCls}>Title *</label>
        <input
          required
          minLength={3}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. iPhone 14 Pro Max 256GB"
          className={inputCls}
        />
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description *</label>
        <textarea
          required
          minLength={10}
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your item in detail — condition, included accessories, reason for selling…"
          className={inputCls}
        />
      </div>

      {/* Price + Currency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Price *</label>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={priceCents}
            onChange={(e) => setPriceCents(e.target.value)}
            placeholder="0.00"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={inputCls}
          >
            <option value="GHS">GHS — Ghana Cedi</option>
            <option value="NGN">NGN — Nigerian Naira</option>
            <option value="KES">KES — Kenyan Shilling</option>
            <option value="ZAR">ZAR — South African Rand</option>
            <option value="USD">USD — US Dollar</option>
          </select>
        </div>
      </div>

      {/* Location */}
      <div>
        <label className={labelCls}>Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Accra, Ghana"
          className={inputCls}
        />
      </div>

      {/* Status */}
      <div>
        <label className={labelCls}>Publish status</label>
        <div className="flex gap-3">
          {(['DRAFT', 'PUBLISHED'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                status === s
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {s === 'DRAFT' ? 'Save as draft' : 'Publish now'}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Drafts are not visible to buyers. You can publish later.
        </p>
      </div>

      {/* Variants */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls + ' mb-0'}>Variants</label>
          <button
            type="button"
            onClick={addVariant}
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            + Add variant
          </button>
        </div>
        {variants.length === 0 ? (
          <p className="text-xs text-slate-500">
            Optional — use variants for sizes, colours, bundles, etc.
          </p>
        ) : (
          <div className="space-y-2">
            {variants.map((v, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  placeholder="Label (e.g. Size M)"
                  value={v.label}
                  onChange={(e) => updateVariant(idx, 'label', e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Price"
                  value={v.priceCents}
                  onChange={(e) => updateVariant(idx, 'priceCents', e.target.value)}
                  className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeVariant(idx)}
                  className="text-xs text-red-400 hover:text-red-300 px-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-2 text-sm text-red-400">
          {(error as Error)?.message ?? 'Something went wrong. Please try again.'}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
        >
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create listing'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/app/listings' as any)}
          className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
