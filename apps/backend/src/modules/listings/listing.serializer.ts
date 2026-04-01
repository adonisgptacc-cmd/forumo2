// Local type definitions mirroring shared DTOs to avoid cross-package type resolution during Next.js type checking
export type ListingImage = {
  id: string;
  bucket?: string;
  storageKey?: string;
  url?: string;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  position?: number | null;
  createdAt?: string | Date;
  listingId?: string;
};

export type ListingVariant = {
  id?: string;
  label: string;
  priceCents: number;
  currency?: string;
  sku?: string | null;
  inventoryCount?: number | null;
  metadata?: unknown;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  listingId?: string;
};

export type SafeListing = {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED';
  moderationStatus?: string;
  location?: string | null;
  metadata?: unknown;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  variants?: ListingVariant[];
  images?: ListingImage[];
};

export type ListingWithRelations = SafeListing & {
  images?: ListingImage[] | null;
  variants?: ListingVariant[] | null;
};
export type SafeListingImage = Omit<ListingImage, 'listingId'>;
export type SafeListingVariant = Omit<ListingVariant, 'listingId'>;

// Helper to safely convert JsonValue to Record or null
function toRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

// Helper to convert Date to ISO string
function toISOString(date: Date | string | null | undefined): string | undefined {
  if (!date) return undefined;
  if (date instanceof Date) return date.toISOString();
  return date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const serializeListingImage = (image: any): SafeListingImage => {
  return {
    id: image.id,
    bucket: image.bucket,
    storageKey: image.storageKey,
    url: image.url,
    mimeType: image.mimeType,
    fileSize: image.fileSize,
    width: image.width,
    height: image.height,
    position: image.position,
    createdAt: toISOString(image.createdAt),
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const serializeListingVariant = (variant: any): SafeListingVariant => {
  return {
    id: variant.id,
    label: variant.label,
    priceCents: variant.priceCents,
    currency: variant.currency,
    sku: variant.sku,
    inventoryCount: variant.inventoryCount,
    metadata: toRecord(variant.metadata),
    createdAt: toISOString(variant.createdAt),
    updatedAt: toISOString(variant.updatedAt),
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const serializeListing = (listing: any): SafeListing => {
  return {
    id: listing.id,
    sellerId: listing.sellerId,
    title: listing.title,
    description: listing.description,
    priceCents: listing.priceCents,
    currency: listing.currency,
    status: listing.status,
    moderationStatus: listing.moderationStatus,
    location: listing.location,
    metadata: toRecord(listing.metadata),
    createdAt: toISOString(listing.createdAt),
    updatedAt: toISOString(listing.updatedAt),
    images: (listing.images ?? []).map(serializeListingImage),
    variants: (listing.variants ?? []).map(serializeListingVariant),
  };
};
