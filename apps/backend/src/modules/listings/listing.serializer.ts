import { Listing, ListingImage, ListingVariant } from '@prisma/client';

export type ListingWithRelations = Listing & {
  images: ListingImage[];
  variants: ListingVariant[];
};

export type SafeListingImage = Omit<ListingImage, 'listingId'>;
export type SafeListingVariant = Omit<ListingVariant, 'listingId'>;
export type SafeListing = Listing & {
  images: SafeListingImage[];
  variants: SafeListingVariant[];
};

export const serializeListingImage = (image: ListingImage): SafeListingImage => {
  const { listingId, ...rest } = image;
  return rest;
};

export const serializeListingVariant = (variant: ListingVariant): SafeListingVariant => {
  const { listingId, ...rest } = variant;
  return rest;
};

export const serializeListing = (listing: ListingWithRelations): SafeListing => {
  return {
    ...listing,
    images: (listing.images ?? []).map(serializeListingImage),
    variants: (listing.variants ?? []).map(serializeListingVariant),
  };
};
