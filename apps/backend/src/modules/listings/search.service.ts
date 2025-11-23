import { BadRequestException, Injectable } from '@nestjs/common';
import { ListingStatus, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service.js';
import { listingDefaultInclude } from './listings.prisma.js';
import { ListingWithRelations, SafeListing, serializeListing } from './listing.serializer.js';
import { CacheService } from '../../common/services/cache.service.js';

export interface ListingSearchParams {
  keyword?: string;
  page: number;
  pageSize: number;
  status?: ListingStatus;
  minPriceCents?: number;
  maxPriceCents?: number;
  sellerId?: string;
  tags?: string[];
}

export interface ListingSearchResponse {
  data: SafeListing[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

@Injectable()
export class ListingSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async search(params: ListingSearchParams): Promise<ListingSearchResponse> {
    const page = params.page > 0 ? params.page : 1;
    const cappedPageSize = Math.min(params.pageSize > 0 ? params.pageSize : 12, 50);
    const offset = (page - 1) * cappedPageSize;

    const cacheKey = this.buildCacheKey({ ...params, page, pageSize: cappedPageSize });
    const cached = await this.cache.get<ListingSearchResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    if (
      params.maxPriceCents !== undefined &&
      params.minPriceCents !== undefined &&
      params.maxPriceCents < params.minPriceCents
    ) {
      throw new BadRequestException('maxPriceCents must be greater than or equal to minPriceCents');
    }

    const tagSlugs = this.normalizeTags(params.tags);
    const where: Prisma.ListingWhereInput = this.buildWhereFilter(params, tagSlugs);

    if (!params.keyword) {
      const [total, listings] = await this.prisma.$transaction([
        this.prisma.listing.count({ where }),
        this.prisma.listing.findMany({
          where,
          skip: offset,
          take: cappedPageSize,
          orderBy: { createdAt: 'desc' },
          include: listingDefaultInclude,
        }),
      ]);
      const typedListings = listings as ListingWithRelations[];

      const pageCount = cappedPageSize === 0 ? 0 : Math.max(1, Math.ceil(total / cappedPageSize));

      const response: ListingSearchResponse = {
        data: typedListings.map((listing) => serializeListing(listing)),
        total,
        page,
        pageSize: cappedPageSize,
        pageCount: total === 0 ? 0 : pageCount,
      };
      await this.cache.set(cacheKey, response, this.cacheTtlMs);
      return response;
    }

    const tsQuery = this.buildKeywordQuery(params.keyword);
    const searchableCte = this.buildSearchableCte(params, tagSlugs);

    const countQuery = Prisma.sql`
      ${searchableCte}
      SELECT COUNT(*)::int as count
      FROM searchable
      WHERE document @@ ${tsQuery}
    `;

    const searchQuery = Prisma.sql`
      ${searchableCte}
      SELECT s."id", ts_rank_cd(s.document, ${tsQuery}) as rank, s."createdAt"
      FROM searchable s
      WHERE s.document @@ ${tsQuery}
      ORDER BY rank DESC, s."createdAt" DESC
      LIMIT ${cappedPageSize}
      OFFSET ${offset}
    `;

    const [countRows, rows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<{ count: number }[]>(countQuery),
      this.prisma.$queryRaw<{ id: string }[]>(searchQuery),
    ]);

    const total = countRows?.[0]?.count ?? 0;
    const listingIds = rows.map((row) => row.id);
    const listings = (listingIds.length
      ? await this.prisma.listing.findMany({
          where: { id: { in: listingIds } },
          include: listingDefaultInclude,
        })
      : []) as ListingWithRelations[];
    const listingMap = new Map(listings.map((listing) => [listing.id, listing]));
    const ordered = listingIds
      .map((id) => listingMap.get(id))
      .filter((listing): listing is ListingWithRelations => Boolean(listing));

    const pageCount = cappedPageSize === 0 ? 0 : Math.max(1, Math.ceil(total / cappedPageSize));

    const response: ListingSearchResponse = {
      data: ordered.map((listing) => serializeListing(listing)),
      total,
      page,
      pageSize: cappedPageSize,
      pageCount: total === 0 ? 0 : pageCount,
    };
    await this.cache.set(cacheKey, response, this.cacheTtlMs);
    return response;
  }

  private buildCacheKey(params: ListingSearchParams & { page: number; pageSize: number }): string {
    return `listings:search:${JSON.stringify(params)}`;
  }

  private get cacheTtlMs() {
    const ttlSeconds = Number(this.configService.get<string>('CACHE_TTL_SECONDS') ?? 30);
    return (Number.isNaN(ttlSeconds) ? 30 : ttlSeconds) * 1000;
  }

  private normalizeTags(tags?: string[]): string[] {
    return (tags ?? [])
      .map((tag) => tag?.trim())
      .filter((tag): tag is string => Boolean(tag))
      .map((tag) => tag.toLowerCase());
  }

  private buildKeywordQuery(keyword: string) {
    const normalized = keyword.trim().replace(/\s+/g, ' ');
    return Prisma.sql`websearch_to_tsquery('english', ${normalized})`;
  }

  private buildWhereFilter(
    params: ListingSearchParams,
    tagSlugs: string[],
  ): Prisma.ListingWhereInput {
    const where: Prisma.ListingWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.sellerId ? { sellerId: params.sellerId } : {}),
      ...(tagSlugs.length
        ? {
            tags: {
              some: {
                tag: { slug: { in: tagSlugs } },
              },
            },
          }
        : {}),
    };

    if (params.minPriceCents !== undefined || params.maxPriceCents !== undefined) {
      where.priceCents = {
        ...(params.minPriceCents !== undefined ? { gte: params.minPriceCents } : {}),
        ...(params.maxPriceCents !== undefined ? { lte: params.maxPriceCents } : {}),
      };
    }

    return where;
  }

  private buildSqlConditions(params: ListingSearchParams, tagSlugs: string[]) {
    const conditions: Prisma.Sql[] = [Prisma.sql`l."deletedAt" IS NULL`];

    if (params.status) {
      conditions.push(Prisma.sql`l."status" = ${params.status}`);
    }
    if (params.sellerId) {
      conditions.push(Prisma.sql`l."sellerId" = ${params.sellerId}`);
    }
    if (params.minPriceCents !== undefined) {
      conditions.push(Prisma.sql`l."priceCents" >= ${params.minPriceCents}`);
    }
    if (params.maxPriceCents !== undefined) {
      conditions.push(Prisma.sql`l."priceCents" <= ${params.maxPriceCents}`);
    }
    if (tagSlugs.length) {
      conditions.push(Prisma.sql`lt."slug" IN (${Prisma.join(tagSlugs.map((tag) => Prisma.sql`${tag}`))})`);
    }

    return conditions;
  }

  private buildSearchableCte(params: ListingSearchParams, tagSlugs: string[]) {
    const conditions = this.buildSqlConditions(params, tagSlugs);
    const whereSql = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const document = Prisma.sql`
      setweight(to_tsvector('english', coalesce(l."title", '')), 'A') ||
      setweight(to_tsvector('english', coalesce(l."description", '')), 'B') ||
      setweight(to_tsvector('english', coalesce(string_agg(DISTINCT lt."label", ' '), '')), 'C')
    `;

    return Prisma.sql`
      WITH searchable AS (
        SELECT l."id", l."createdAt", ${document} as document
        FROM "Listing" l
        LEFT JOIN "ListingTagAssignment" lta ON lta."listingId" = l."id"
        LEFT JOIN "ListingTag" lt ON lt."id" = lta."tagId"
        ${whereSql}
        GROUP BY l."id", l."createdAt"
      )
    `;
  }
}
