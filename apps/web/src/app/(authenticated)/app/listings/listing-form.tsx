'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
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
  const { createMutation, updateMutation, uploadImageMutation } = useListingMutations();
  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!listing;
  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;
  const error = isEdit ? updateMutation.error : createMutation.error;

  // After create we hold the new listing ID here so we can upload images before navigating away
  const [savedListingId, setSavedListingId] = useState<string | null>(
    isEdit ? listing.id : null,
  );
  // Local preview blobs before upload
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  // Uploaded images (from API)
  const [uploadedImages, setUploadedImages] = useState(listing?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
  const [variants, setVariants] = useState<{ label: string; priceCents: string }[]>(
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
      setUploadedImages(listing.images ?? []);
      setSavedListingId(listing.id);
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const allowed = files.filter((f) => f.type.startsWith('image/'));
    setPendingFiles((prev) => [...prev, ...allowed]);
    // reset input so the same file can be re-added if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePendingFile(idx: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function uploadPendingFiles(listingId: string) {
    if (!pendingFiles.length) return;
    setUploading(true);
    setUploadError(null);
    const results: typeof uploadedImages = [];
    for (const file of pendingFiles) {
      try {
        const img = await uploadImageMutation.mutateAsync({ listingId, file });
        results.push(img);
      } catch {
        setUploadError(`Failed to upload "${file.name}". Other images were saved.`);
      }
    }
    setUploadedImages((prev) => [...prev, ...results]);
    setPendingFiles([]);
    setUploading(false);
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
      await uploadPendingFiles(listing.id);
      router.push('/app/listings' as any);
    } else {
      const created = await createMutation.mutateAsync(payload);
      setSavedListingId(created.id);
      if (pendingFiles.length) {
        await uploadPendingFiles(created.id);
      } else {
        router.push('/app/listings' as any);
      }
    }
  }

  const inputCls =
    'w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]';
  const labelCls = 'mb-1 block text-sm font-medium text-[color:var(--ink-2)]';

  // After a new listing is saved and pending uploads were flushed, show done state
  const showUploadDone =
    !isEdit && savedListingId && pendingFiles.length === 0 && !uploading && !createMutation.isPending;

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
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)] text-[color:var(--accent-2)]'
                  : 'border-[color:var(--line-2)] text-[color:var(--ink-3)] hover:border-[color:var(--ink-3)]'
              }`}
            >
              {s === 'DRAFT' ? 'Save as draft' : 'Publish now'}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs muted">
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
            className="text-xs text-[color:var(--accent)] hover:text-[color:var(--accent-2)]"
          >
            + Add variant
          </button>
        </div>
        {variants.length === 0 ? (
          <p className="text-xs muted">
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
                  className="flex-1 rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Price"
                  value={v.priceCents}
                  onChange={(e) => updateVariant(idx, 'priceCents', e.target.value)}
                  className="w-28 rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
                />
                <button
                  type="button"
                  onClick={() => removeVariant(idx)}
                  className="text-xs text-red-600 hover:text-red-700 px-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Images */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls + ' mb-0'}>Photos</label>
          <span className="text-xs muted">
            {uploadedImages.length + pendingFiles.length} / 10
          </span>
        </div>

        {/* Existing uploaded images */}
        {uploadedImages.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {uploadedImages.map((img, idx) => (
              <div
                key={img.url ?? idx}
                className="relative h-20 w-20 rounded-lg overflow-hidden border border-[color:var(--line-2)]"
              >
                <Image
                  src={img.url ?? ''}
                  alt={`Photo ${idx + 1}`}
                  fill
                  className="object-cover"
                />
                {idx === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 bg-[color:var(--accent)] text-center text-[10px] font-semibold text-white py-0.5">
                    Cover
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pending (not yet uploaded) previews */}
        {pendingFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {pendingFiles.map((file, idx) => (
              <div
                key={idx}
                className="relative h-20 w-20 rounded-lg overflow-hidden border border-dashed border-[color:var(--accent)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePendingFile(idx)}
                  className="absolute top-0.5 right-0.5 rounded-full bg-black/70 px-1 text-xs text-white hover:bg-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadedImages.length + pendingFiles.length >= 10}
          className="flex items-center gap-2 rounded-lg border border-dashed border-[color:var(--line-2)] px-4 py-3 text-sm text-[color:var(--ink-3)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add photos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="mt-1 text-xs muted">
          JPG, PNG, WebP — max 10 photos. First photo is the cover image.
        </p>
        {uploadError && (
          <p className="mt-1 text-xs text-red-600">{uploadError}</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {(error as Error)?.message ?? 'Something went wrong. Please try again.'}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || uploading}
          className="btn btn-primary"
        >
          {uploading
            ? 'Uploading photos…'
            : pending
            ? 'Saving…'
            : isEdit
            ? 'Save changes'
            : 'Create listing'}
        </button>
        {showUploadDone && (
          <button
            type="button"
            onClick={() => router.push('/app/listings' as any)}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Done — view listings
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push('/app/listings' as any)}
          className="btn btn-ghost"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
