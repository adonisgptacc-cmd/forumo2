import { ListingModerationStatus, ListingStatus } from '@prisma/client';

import { ListingSearchService } from './search.service.js';

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
  metadata: { tags: ['kente', 'textile'] },
  location: 'Accra',
  deletedAt: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  images: [],
  variants: [],
} as const;
const listingB = { ...listingA, id: 'listing-b', title: 'Modern Basket', priceCents: 12500 } as const;

describe('ListingSearchService', () => {
  let prisma: any;
  let service: ListingSearchService;

  beforeEach(() => {
    prisma = {
      listing: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([listingA]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: listingA.id }]),
      $transaction: jest.fn().mockImplementation((actions: Promise<unknown>[]) => Promise.all(actions)),
    };

    service = new ListingSearchService(prisma as any);
  });

  it('applies relevance ranking when keyword is provided', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ count: 2 }]);
    prisma.$queryRaw.mockResolvedValueOnce([
      { id: listingB.id, rank: 0.9, snippet: '<b>basket</b>' },
      { id: listingA.id, rank: 0.5, snippet: null },
    ]);
    prisma.listing.findMany.mockResolvedValue([listingA, listingB]);

    const result = await service.search({ keyword: 'kente', page: 1, pageSize: 10, sort: 'relevance' });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result.data.map((listing) => listing.id)).toEqual([listingB.id, listingA.id]);
    expect(result.data[0].relevanceScore).toBe(0.9);
    expect(result.data[0].snippet).toBe('<b>basket</b>');
  });

  it('combines tag, status, price, and seller filters without a keyword', async () => {
    await service.search({
      keyword: undefined,
      page: 1,
      pageSize: 10,
      status: ListingStatus.PAUSED,
      minPriceCents: 1000,
      maxPriceCents: 5000,
      sellerId: 'seller-2',
      sellerIds: ['seller-3'],
      categories: ['bags'],
      tags: ['Handmade', 'Basket'],
      createdAfter: new Date('2024-01-01'),
      createdBefore: new Date('2024-02-01'),
    });

    const expectedWhere = {
      deletedAt: null,
      status: ListingStatus.PAUSED,
      sellerId: { in: ['seller-3', 'seller-2'] },
      priceCents: { gte: 1000, lte: 5000 },
      createdAt: { gte: new Date('2024-01-01'), lte: new Date('2024-02-01') },
      tags: { some: { tag: { slug: { in: ['handmade', 'basket'] } } } },
      categories: { some: { category: { slug: { in: ['bags'] } } } },
    };

    expect(prisma.listing.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
  });

  it('normalizes keyword spacing and uses multiple tsquery strategies', () => {
    const { tsQueries, headlineQuery } = (service as any).buildKeywordQueries('  woven   cloth ');
    expect(tsQueries.baseQuery.values?.[0]).toBe('woven cloth');
    expect(Array.isArray(tsQueries.baseQuery.strings)).toBe(true);
    expect(tsQueries.baseQuery.strings.join(' ')).toContain('websearch_to_tsquery');
    expect(headlineQuery).toBe(tsQueries.baseQuery);
  });

  it('constructs a weighted search document with filters applied in the CTE', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ count: 1 }]);
    prisma.$queryRaw.mockResolvedValueOnce([{ id: listingA.id }]);

    await service.search({
      keyword: 'basket',
      page: 2,
      pageSize: 5,
      minPriceCents: 1000,
      maxPriceCents: 5000,
      categories: ['craft'],
      tags: ['woven'],
    });

    const cteSql = (prisma.$queryRaw.mock.calls[0]?.[0] as any).strings.join(' ');
    expect(cteSql).toContain('WITH searchable AS');
    expect(cteSql).toContain('setweight(to_tsvector');
    expect(cteSql).toContain('coalesce(l."title"');
    expect(cteSql).toContain('coalesce(l."description"');
    expect(cteSql).toContain('string_agg');
    expect(cteSql).toContain('l."priceCents" >=');
    expect(cteSql).toContain('l."priceCents" <=');
    expect(cteSql).toContain('lt."slug"');
    expect(cteSql).toContain('lc."slug"');
  });

  it('orders keyword results by rank then createdAt', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ count: 1 }]);
    prisma.$queryRaw.mockResolvedValueOnce([{ id: listingA.id }]);

    await service.search({ keyword: 'kente', page: 1, pageSize: 5 });

    const searchSql = (prisma.$queryRaw.mock.calls[1]?.[0] as any).strings.join(' ');
    expect(searchSql).toContain('ORDER BY rank DESC, s."createdAt" DESC');
  });
});
