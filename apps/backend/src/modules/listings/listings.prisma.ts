import { Prisma } from '@prisma/client';

export const listingDefaultInclude: Prisma.ListingInclude = {
  images: {
    orderBy: { position: 'asc' },
  },
  variants: {
    orderBy: { createdAt: 'asc' },
  },
};
