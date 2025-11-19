import { ListingModerationStatus, ListingStatus } from '@prisma/client';

import { ListingsService } from './listings.service.js';

describe('ListingsService searchListings', () => {
  const listingA = {
    id: 'listing-a',
    sellerId: 'seller-1',
    title: 'Vintage Kente',
    description: 'Hand woven cloth',
    priceCents: 45000,
    currency: 'USD',
    status: ListingStatus.PUBLISHED,
    moderationStatus: ListingModerationStatus.APPROVED,
    moderationNotes: null,
    metadata: null,
    location: 'Accra',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    images: [],
    variants: [],
  } as const;
  const listingB = { ...listingA, id: 'listing-b', title: 'Modern Basket' } as const;

  let prisma: any;
  let service: ListingsService;

  beforeEach(() => {
    prisma = {
      listing: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([listingA]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: listingA.id }]),
      $transaction: jest.fn().mockImplementation((actions: Promise<unknown>[]) => Promise.all(actions)),
    };

    service = new ListingsService(prisma, {} as any, {} as any);
  });

  it('applies relevance ranking when keyword is provided', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: listingB.id }, { id: listingA.id }]);
    prisma.listing.findMany.mockResolvedValue([listingA, listingB]);

    const result = await service.searchListings({ keyword: 'kente', page: 1, pageSize: 10 });

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result.data.map((listing) => listing.id)).toEqual([listingB.id, listingA.id]);
  });

  it('supports pagination through skip and take', async () => {
    const result = await service.searchListings({ keyword: undefined, page: 3, pageSize: 5 });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 5,
      }),
    );
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(5);
  });

  it('combines status, price, and seller filters', async () => {
    await service.searchListings({
      keyword: undefined,
      page: 1,
      pageSize: 10,
      status: ListingStatus.PAUSED,
      minPriceCents: 1000,
      maxPriceCents: 5000,
      sellerId: 'seller-2',
    });

    const expectedWhere = {
      deletedAt: null,
      status: ListingStatus.PAUSED,
      sellerId: 'seller-2',
      priceCents: { gte: 1000, lte: 5000 },
    };

    expect(prisma.listing.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
  });
});
