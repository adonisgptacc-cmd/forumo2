'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type {
  CreateListingDto,
  CreateListingVariantDto,
  SafeListing,
  ListingImage,
  ListingVariant,
  UpdateListingDto,
} from '@forumo/shared';

import { useListingMutations } from '../../../lib/react-query/hooks';
import { useApiClient } from '../../../lib/use-api-client';

const listingStatuses = ['DRAFT', 'PUBLISHED', 'PAUSED'] as const;
const actionButtonClasses =
  'inline-flex items-center justify-center rounded-md border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-70';

type VariantDraft = {
  id?: string;
  label: string;
  price: string;
  currency: string;
  sku?: string;
  inventoryCount?: string;
};

type ListingFormProps = {
  mode: 'create' | 'edit';
  listing?: SafeListing | null;
};

type ValidationError = string;

type SubmitResult = {
  success: boolean;
  message: string;
};

function mapVariantsToDrafts(variants: ListingVariant[] | undefined): VariantDraft[] {
  if (!variants?.length) {
    return [];
  }
  return variants.map((variant) => ({
    id: variant.id,
    label: variant.label,
    price: (variant.priceCents / 100).toString(),
    currency: variant.currency ?? 'USD',
    sku: variant.sku ?? undefined,
    inventoryCount: variant.inventoryCount != null ? String(variant.inventoryCount) : undefined,
  }));
}

function toCreateListingVariant(draft: VariantDraft): CreateListingVariantDto {
  return {
    label: draft.label.trim(),
    priceCents: Math.round(parseFloat(draft.price) * 100),
    currency: draft.currency || undefined,
    sku: draft.sku?.trim() || undefined,
    inventoryCount: draft.inventoryCount ? Number(draft.inventoryCount) : undefined,
  };
}

function validateListingFields(
  params: Pick<SafeListing, 'title' | 'description' | 'sellerId' | 'currency' | 'status'> & {
    price: string;
  },
  mode: ListingFormProps['mode'],
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (mode === 'create' && !params.sellerId.trim()) {
    errors.push('Seller ID is required.');
  }
  if (!params.title.trim()) {
    errors.push('Title is required.');
  }
  if (!params.description.trim()) {
    errors.push('Description is required.');
  }
  if (!params.price.trim() || Number.isNaN(Number(params.price))) {
    errors.push('Price must be a valid number.');
  }
  if (!params.currency.trim()) {
    errors.push('Currency is required.');
  }
  if (!listingStatuses.includes(params.status as (typeof listingStatuses)[number])) {
    errors.push('Status must be one of the supported values.');
  }
  return errors;
}

export function ListingForm({ mode, listing }: ListingFormProps) {
  const router = useRouter();
  const [sellerId, setSellerId] = useState(listing?.sellerId ?? '');
  const [title, setTitle] = useState(listing?.title ?? '');
  const [description, setDescription] = useState(listing?.description ?? '');
  const [price, setPrice] = useState(listing ? (listing.priceCents / 100).toString() : '');
  const [currency, setCurrency] = useState(listing?.currency ?? 'USD');
  const [status, setStatus] = useState(listing?.status ?? 'DRAFT');
  const [location, setLocation] = useState(listing?.location ?? '');
  const [variants, setVariants] = useState<VariantDraft[]>(mapVariantsToDrafts(listing?.variants));
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [message, setMessage] = useState<SubmitResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiClient = useApiClient();
  const { createMutation, updateMutation } = useListingMutations();
  const isMutating = createMutation.isPending || updateMutation.isPending;

  const existingImages: ListingImage[] = listing?.images ?? [];

  const buttonLabel = mode === 'create' ? 'Create listing' : 'Save changes';

  const handleVariantChange = (index: number, field: keyof VariantDraft, value: string) => {
    setVariants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, { label: '', price: '', currency: currency || 'USD' }]);
  };

  const removeVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = event.target.files ? Array.from(event.target.files) : [];
    setFiles(incoming);
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const validationErrors = validateListingFields(
      { sellerId, title, description, price, currency, status },
      mode,
    );
    const normalizedVariants = variants.filter((variant) => variant.label.trim() || variant.price.trim());
    normalizedVariants.forEach((variant, index) => {
      if (!variant.label.trim()) {
        validationErrors.push(`Variant #${index + 1} must include a label.`);
      }
      if (!variant.price.trim() || Number.isNaN(Number(variant.price))) {
        validationErrors.push(`Variant #${index + 1} must include a valid price.`);
      }
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setIsSubmitting(true);

    const payload: Partial<CreateListingDto> & Partial<UpdateListingDto> = {
      title: title.trim(),
      description: description.trim(),
      priceCents: Math.round(parseFloat(price) * 100),
      currency: currency.trim(),
      status,
      location: location.trim() || undefined,
    };

    if (mode === 'create') {
      payload.sellerId = sellerId.trim();
    }

    if (normalizedVariants.length > 0 || (mode === 'edit' && listing?.variants)) {
      payload.variants = normalizedVariants.map(toCreateListingVariant);
    }

    try {
      const savedListing =
        mode === 'create'
          ? await createMutation.mutateAsync(payload as CreateListingDto)
          : await updateMutation.mutateAsync({ id: listing!.id, payload: payload as UpdateListingDto });

      if (files.length > 0) {
        for (const file of files) {
          await apiClient.listings.uploadImage(savedListing.id, file);
        }
      }

      setMessage({ success: true, message: 'Listing saved! Redirecting…' });
      router.push(`/listings/${savedListing.id}`);
      router.refresh();
    } catch (error) {
      const err = error as Error;
      setMessage({ success: false, message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {errors.length > 0 ? (
        <div className="rounded-md border border-red-500/60 bg-red-500/10 p-4 text-sm text-red-200">
          <p className="font-semibold">Please fix the following:</p>
          <ul className="list-disc space-y-1 pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {message ? (
        <div
          className={`rounded-md border p-3 text-sm ${
            message.success ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-red-500/40 bg-red-500/10 text-red-200'
          }`}
        >
          {message.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-slate-300">Seller ID {mode === 'create' ? '*' : ''}</span>
          <input
            type="text"
            className="input"
            value={sellerId}
            onChange={(event) => setSellerId(event.target.value)}
            placeholder="seller_123"
            required={mode === 'create'}
            disabled={mode === 'edit'}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-300">Status</span>
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
            {listingStatuses.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {statusOption}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-slate-300">Title *</span>
          <input type="text" className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-slate-300">Description *</span>
          <textarea
            className="input min-h-[120px]"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-300">Price (in {currency}) *</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-300">Currency *</span>
          <input
            type="text"
            className="input"
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-slate-300">Location</span>
          <input
            type="text"
            className="input"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </label>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Variants</h2>
          <button type="button" className="text-sm text-amber-300" onClick={addVariant}>
            + Add variant
          </button>
        </div>
        {variants.length === 0 ? (
          <p className="text-sm text-slate-400">No variants configured. Add one to override pricing per option.</p>
        ) : (
          <div className="space-y-3">
            {variants.map((variant, index) => (
              <div key={variant.id ?? index} className="rounded-md border border-slate-800 p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                  <span>Variant #{index + 1}</span>
                  <button type="button" className="text-amber-300" onClick={() => removeVariant(index)}>
                    Remove
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="text-slate-300">Label *</span>
                    <input
                      type="text"
                      className="input"
                      value={variant.label}
                      onChange={(event) => handleVariantChange(index, 'label', event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-slate-300">Price *</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={variant.price}
                      onChange={(event) => handleVariantChange(index, 'price', event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-slate-300">Currency</span>
                    <input
                      type="text"
                      className="input"
                      value={variant.currency}
                      onChange={(event) => handleVariantChange(index, 'currency', event.target.value.toUpperCase())}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-slate-300">SKU</span>
                    <input
                      type="text"
                      className="input"
                      value={variant.sku ?? ''}
                      onChange={(event) => handleVariantChange(index, 'sku', event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-slate-300">Inventory</span>
                    <input
                      type="number"
                      min="0"
                      className="input"
                      value={variant.inventoryCount ?? ''}
                      onChange={(event) => handleVariantChange(index, 'inventoryCount', event.target.value)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Images</h2>
        {existingImages.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {existingImages.map((image) => (
              <div key={image.id} className="space-y-2 rounded-md border border-slate-800 p-2 text-sm">
                <p className="truncate text-xs text-slate-400">{image.storageKey ?? image.url}</p>
                {image.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt={title} className="h-32 w-full rounded-md object-cover" />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No images attached yet.</p>
        )}
        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Upload images</span>
          <input type="file" accept="image/*" multiple onChange={handleFileChange} />
        </label>
        {files.length > 0 ? (
          <ul className="text-sm text-slate-400">
            {files.map((file) => (
              <li key={file.name}>{file.name}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" className={actionButtonClasses} disabled={isSubmitting || isMutating}>
          {isSubmitting || isMutating ? 'Saving…' : buttonLabel}
        </button>
        <p className="text-xs text-slate-500">All required fields are marked with *</p>
      </div>
    </form>
  );
}
