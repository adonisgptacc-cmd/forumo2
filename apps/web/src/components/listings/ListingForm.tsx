'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { SafeListing, ListingCategory, CreateAuctionDto } from '@forumo/shared';
import {
  useListingMutations,
  useCategories,
  useCurrentUser,
  useCreateAuction,
} from '../../lib/react-query/hooks';
import { createApiClient } from '../../lib/api-client';

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]';
const labelCls = 'mb-1 block text-sm font-medium text-[color:var(--ink-2)]';
const errorCls = 'mt-1 text-xs font-medium text-[oklch(0.55_0.22_27)]';

// ─── Form values (all strings — HTML inputs return strings) ───────────────────

interface FormValues {
  title: string;
  description: string;
  price: string;
  condition: '' | 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR';
  quantity: string;
  location: string;
  categoryId: string;
  status: 'DRAFT' | 'PUBLISHED';
  isAuction: boolean;
  auctionStartPrice: string;
  auctionReservePrice: string;
  auctionDurationDays: string;
}

// ─── Validation (mirrors CreateListingDto backend schema) ─────────────────────

function validate(v: FormValues): Partial<Record<keyof FormValues, string>> {
  const e: Partial<Record<keyof FormValues, string>> = {};

  if (!v.title || v.title.trim().length < 3) e.title = 'At least 3 characters';
  if (!v.description || v.description.trim().length < 10)
    e.description = 'At least 10 characters';

  const price = parseFloat(v.price);
  if (!v.price || isNaN(price) || price <= 0) e.price = 'Must be greater than 0';

  if (v.quantity) {
    const qty = parseInt(v.quantity, 10);
    if (isNaN(qty) || qty < 1) e.quantity = 'Must be at least 1';
  }

  if (v.isAuction) {
    const sp = parseFloat(v.auctionStartPrice);
    if (!v.auctionStartPrice || isNaN(sp) || sp <= 0)
      e.auctionStartPrice = 'Starting bid is required';
    const dd = parseInt(v.auctionDurationDays, 10);
    if (!v.auctionDurationDays || isNaN(dd) || dd < 1)
      e.auctionDurationDays = 'Duration must be at least 1 day';
  }

  return e;
}

// ─── Image state ──────────────────────────────────────────────────────────────

interface ImageItem {
  key: string;
  preview: string;
  file?: File;
  existingId?: string;
}

// ─── Category tree helpers ────────────────────────────────────────────────────

function flattenCategories(
  cats: ListingCategory[],
  depth = 0,
): { id: string; label: string }[] {
  return cats.flatMap((c) => [
    {
      id: c.id,
      label: ' '.repeat(depth * 4) + (depth > 0 ? '└ ' : '') + c.name,
    },
    // children is not on the shared SafeCategory type but is returned by the API
    ...flattenCategories((c as any).children ?? [], depth + 1),
  ]);
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ListingFormProps {
  mode: 'create' | 'edit';
  listing?: SafeListing;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ListingForm({ mode, listing }: ListingFormProps) {
  const router = useRouter();
  const { accessToken } = useCurrentUser();
  const api = useMemo(() => createApiClient(accessToken), [accessToken]);

  const { createMutation, updateMutation, uploadImageMutation } = useListingMutations();
  const createAuction = useCreateAuction();
  const { data: categoriesData } = useCategories();

  const flatCategories = useMemo(
    () => (categoriesData ? flattenCategories(categoriesData) : []),
    [categoriesData],
  );

  const existingCondition = ((listing?.metadata as any)?.condition as FormValues['condition']) ?? '';
  const existingQuantity =
    listing?.variants?.[0]?.inventoryCount != null
      ? String(listing.variants[0].inventoryCount)
      : '';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors: rhfErrors },
    setError,
    clearErrors,
  } = useForm<FormValues>({
    defaultValues: {
      title: listing?.title ?? '',
      description: listing?.description ?? '',
      price: listing ? (listing.priceCents / 100).toFixed(2) : '',
      condition: existingCondition,
      quantity: existingQuantity,
      location: listing?.location ?? '',
      categoryId: '',
      status: listing?.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
      isAuction: false,
      auctionStartPrice: '',
      auctionReservePrice: '',
      auctionDurationDays: '7',
    },
  });

  const isAuction = watch('isAuction');

  // ─── Image state ────────────────────────────────────────────────────────────

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageItem[]>(() =>
    (listing?.images ?? []).map((img) => ({
      key: img.id,
      preview: img.url ?? '',
      existingId: img.id,
    })),
  );
  const dragIndexRef = useRef<number>(-1);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const next: ImageItem[] = Array.from(files).map((f) => ({
      key: Math.random().toString(36).slice(2),
      preview: URL.createObjectURL(f),
      file: f,
    }));
    setImages((prev) => [...prev, ...next]);
  }, []);

  const removeImage = useCallback((key: string) => {
    setImages((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDrop = (targetIndex: number) => {
    const from = dragIndexRef.current;
    if (from === -1 || from === targetIndex) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    dragIndexRef.current = -1;
  };

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const onSubmit = handleSubmit(async (data) => {
    const validationErrors = validate(data);
    if (Object.keys(validationErrors).length > 0) {
      for (const [field, message] of Object.entries(validationErrors)) {
        setError(field as keyof FormValues, { message });
      }
      return;
    }
    clearErrors();
    setSubmitting(true);
    setSubmitError('');

    try {
      const priceCents = Math.round(parseFloat(data.price) * 100);
      const variants = data.quantity
        ? [{ label: 'Default', priceCents, inventoryCount: parseInt(data.quantity, 10) }]
        : undefined;
      const metadata: Record<string, unknown> = {};
      if (data.condition) metadata.condition = data.condition;

      let listingId: string;

      if (mode === 'create') {
        const created = await createMutation.mutateAsync({
          title: data.title,
          description: data.description,
          priceCents,
          currency: 'ZAR',
          status: data.status,
          ...(data.location ? { location: data.location } : {}),
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          variants,
        });
        listingId = created.id;
      } else {
        if (!listing) return;
        await updateMutation.mutateAsync({
          id: listing.id,
          payload: {
            title: data.title,
            description: data.description,
            priceCents,
            currency: 'ZAR',
            status: data.status,
            location: data.location || undefined,
            metadata: Object.keys(metadata).length > 0 ? metadata : null,
            variants,
          },
        });
        listingId = listing.id;
      }

      // Upload new images in display order
      for (const img of images) {
        if (img.file) {
          await uploadImageMutation.mutateAsync({ listingId, file: img.file });
        }
      }

      // Assign selected category
      if (data.categoryId) {
        await api.categories.assignCategories(listingId, [data.categoryId], data.categoryId);
      }

      // Create auction (create mode only, when toggled on)
      if (mode === 'create' && data.isAuction && data.auctionStartPrice && data.auctionDurationDays) {
        const auctionPayload: CreateAuctionDto = {
          listingId,
          startingBidCents: Math.round(parseFloat(data.auctionStartPrice) * 100),
          durationDays: parseInt(data.auctionDurationDays, 10),
        };
        if (data.auctionReservePrice) {
          auctionPayload.reserveCents = Math.round(parseFloat(data.auctionReservePrice) * 100);
        }
        await createAuction.mutateAsync(auctionPayload);
      }

      setSubmitSuccess(true);
      setTimeout(() => router.push('/app/listings' as any), 1500);
    } catch (err: unknown) {
      setSubmitError((err as Error)?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  });

  // ─── Success screen ──────────────────────────────────────────────────────────

  if (submitSuccess) {
    return (
      <div
        className="card card-pad text-center space-y-2 fade-up"
        style={{ background: 'var(--escrow-bg)', borderColor: 'transparent' }}
      >
        <p className="text-lg font-semibold text-[color:var(--escrow)]">
          {mode === 'create' ? 'Listing created!' : 'Listing updated!'}
        </p>
        <p className="text-sm muted">Redirecting to your listings…</p>
      </div>
    );
  }

  // ─── Form ────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      {/* Title */}
      <div>
        <label className={labelCls}>Title *</label>
        <input
          {...register('title')}
          placeholder="What are you selling?"
          className={inputCls}
        />
        {rhfErrors.title && <p className={errorCls}>{rhfErrors.title.message}</p>}
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description *</label>
        <textarea
          {...register('description')}
          rows={5}
          placeholder="Describe your item — condition, dimensions, history…"
          className={inputCls + ' resize-y'}
        />
        {rhfErrors.description && <p className={errorCls}>{rhfErrors.description.message}</p>}
      </div>

      {/* Category */}
      <div>
        <label className={labelCls}>Category</label>
        <select {...register('categoryId')} className={inputCls}>
          <option value="">— Select a category —</option>
          {flatCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Price + Condition */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Price (ZAR) *</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)] text-sm select-none">
              R
            </span>
            <input
              {...register('price')}
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              className={inputCls + ' pl-8'}
            />
          </div>
          {rhfErrors.price && <p className={errorCls}>{rhfErrors.price.message}</p>}
        </div>

        <div>
          <label className={labelCls}>Condition</label>
          <select {...register('condition')} className={inputCls}>
            <option value="">— Select condition —</option>
            <option value="NEW">New</option>
            <option value="LIKE_NEW">Like New</option>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
          </select>
        </div>
      </div>

      {/* Stock + Location */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Stock / Quantity</label>
          <input
            {...register('quantity')}
            type="number"
            min="1"
            step="1"
            placeholder="1"
            className={inputCls}
          />
          {rhfErrors.quantity && <p className={errorCls}>{rhfErrors.quantity.message}</p>}
        </div>

        <div>
          <label className={labelCls}>Location</label>
          <input
            {...register('location')}
            placeholder="City or region"
            className={inputCls}
          />
        </div>
      </div>

      {/* Images */}
      <div>
        <label className={labelCls}>Images</label>
        <p className="mb-2 text-xs muted">
          Drag images to reorder. The first image is used as the cover photo.
        </p>

        {/* Drop zone */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          className="w-full rounded-lg border-2 border-dashed border-[color:var(--line-2)] p-6 text-center transition-colors hover:border-[color:var(--accent)] hover:bg-[color:var(--surface-2)] focus:outline-none focus-visible:shadow-[0_0_0_3px_var(--ring-accent)]"
        >
          <p className="text-sm subtle">
            Click or drag images here
          </p>
          <p className="mt-1 text-xs muted">JPEG · PNG · WebP · GIF — max 8 MB each</p>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        {/* Preview grid */}
        {images.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {images.map((img, index) => (
              <div
                key={img.key}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                className="group relative aspect-square cursor-grab overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-2)] active:cursor-grabbing"
              >
                <Image
                  src={img.preview}
                  alt={`Preview ${index + 1}`}
                  fill
                  className="object-cover"
                  unoptimized={img.file !== undefined}
                />
                {index === 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-[color:var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(img.key)}
                  aria-label="Remove image"
                  className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white group-hover:flex"
                >
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auction toggle (create mode only) */}
      {mode === 'create' && (
        <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)] p-4 space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              {...register('isAuction')}
              className="h-4 w-4 rounded border-[color:var(--line-2)] accent-[var(--accent)]"
            />
            <div>
              <span className="text-sm font-medium subtle">Enable auction</span>
              <p className="text-xs muted">Buyers bid — highest bid wins at the deadline</p>
            </div>
          </label>

          {isAuction && (
            <div className="space-y-4 border-t border-[color:var(--line)] pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Starting bid (ZAR) *</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)] text-sm select-none">
                      R
                    </span>
                    <input
                      {...register('auctionStartPrice')}
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      className={inputCls + ' pl-8'}
                    />
                  </div>
                  {rhfErrors.auctionStartPrice && (
                    <p className={errorCls}>{rhfErrors.auctionStartPrice.message}</p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Reserve price (ZAR)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)] text-sm select-none">
                      R
                    </span>
                    <input
                      {...register('auctionReservePrice')}
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Optional"
                      className={inputCls + ' pl-8'}
                    />
                  </div>
                  <p className="mt-1 text-xs muted">
                    Minimum you&apos;ll accept — hidden from buyers
                  </p>
                </div>
              </div>

              <div>
                <label className={labelCls}>Auction duration *</label>
                <select {...register('auctionDurationDays')} className={inputCls}>
                  {[1, 3, 5, 7, 10, 14, 21, 30].map((d) => (
                    <option key={d} value={String(d)}>
                      {d} day{d !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
                {rhfErrors.auctionDurationDays && (
                  <p className={errorCls}>{rhfErrors.auctionDurationDays.message}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Publishing status */}
      <div>
        <label className={labelCls}>Publishing status</label>
        <select {...register('status')} className={inputCls}>
          <option value="PUBLISHED">Publish now</option>
          <option value="DRAFT">Save as draft</option>
        </select>
        <p className="mt-1 text-xs muted">
          Published listings enter moderation review before becoming visible to buyers.
        </p>
      </div>

      {/* Error banner */}
      {submitError && (
        <div className="alert alert-error fade-up" role="alert">
          {submitError}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary btn-lg"
        >
          {submitting
            ? mode === 'create'
              ? 'Creating…'
              : 'Saving…'
            : mode === 'create'
              ? 'Create listing'
              : 'Save changes'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/app/listings' as any)}
          className="btn btn-ghost"
        >
          Cancel
        </button>

        {mode === 'edit' && listing && (
          <DeleteButton listingId={listing.id} />
        )}
      </div>
    </form>
  );
}

// ─── Delete button (inline confirm) ──────────────────────────────────────────

function DeleteButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { deleteListingMutation } = useListingMutations();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="ml-auto flex items-center gap-2 text-sm">
        <span className="muted">Delete this listing?</span>
        <button
          type="button"
          disabled={deleteListingMutation.isPending}
          onClick={async () => {
            await deleteListingMutation.mutateAsync(listingId);
            router.push('/app/listings' as any);
          }}
          className="font-medium text-[oklch(0.55_0.22_27)] hover:text-[oklch(0.50_0.22_27)] disabled:opacity-50"
        >
          {deleteListingMutation.isPending ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="muted hover:text-[color:var(--ink)]"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="ml-auto text-sm font-medium text-[oklch(0.55_0.22_27)] hover:text-[oklch(0.50_0.22_27)]"
    >
      Delete listing
    </button>
  );
}
