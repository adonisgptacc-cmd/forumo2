import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ListingModerationStatus, ListingStatus, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from "../../prisma/prisma.service";
import { listingDefaultInclude } from "./listings.prisma";
import { ListingWithRelations, SafeListing, serializeListing } from "./listing.serializer";
import { CacheService } from "../../common/services/cache.service";

export type ListingSearchSort =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'date_new'
  | 'date_old'
  | 'title';

export interface ListingSearchParams {
  keyword?: string;
  page: number;
  pageSize: number;
  status?: ListingStatus;
  moderationStatus?: ListingModerationStatus;
  minPriceCents?: number;
  maxPriceCents?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  sellerId?: string;
  sellerIds?: string[];
  tags?: string[];
  categories?: string[];
  sort?: ListingSearchSort;
}

export interface ListingSearchResult extends SafeListing {
  relevanceScore?: number;
  snippet?: string | null;
}

export interface ListingSearchResponse {
  data: ListingSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

@Injectable()
export class ListingSearchService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: CacheService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async search(params: ListingSearchParams): Promise<ListingSearchResponse> {
    const page = params.page > 0 ? params.page : 1;
    const cappedPageSize = Math.min(params.pageSize > 0 ? params.pageSize : 20, 100);
    const offset = (page - 1) * cappedPageSize;

    const cacheKey = this.buildCacheKey({ ...params, page, pageSize: cappedPageSize });
    const cached = await this.cache?.get<ListingSearchResponse>(cacheKey);
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

    if (params.createdAfter && params.createdBefore && params.createdAfter > params.createdBefore) {
      throw new BadRequestException('createdBefore must be after createdAfter');
    }

    const tagSlugs = this.normalizeStrings(params.tags);
    const categorySlugs = this.normalizeStrings(params.categories);
    const sellerIds = this.normalizeStrings(params.sellerIds);
    const where: Prisma.ListingWhereInput = this.buildWhereFilter(params, tagSlugs, categorySlugs, sellerIds);

    if (!params.keyword) {
      const [total, listings] = await this.prisma.$transaction([
        this.prisma.listing.count({ where }),
        this.prisma.listing.findMany({
          where,
          skip: offset,
          take: cappedPageSize,
          orderBy: this.buildPrismaOrder(params.sort),
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
      await this.cache?.set(cacheKey, response, this.cacheTtlMs);
      return response;
    }

    const keyword = this.normalizeKeyword(params.keyword);
    const { tsQueries, headlineQuery, similarityTerm } = this.buildKeywordQueries(keyword);
    const searchableCte = this.buildSearchableCte(params, tagSlugs, categorySlugs, sellerIds, keyword);
    const matchCondition = this.buildSearchCondition(tsQueries, similarityTerm);
    const rankExpression = this.buildRankExpression(tsQueries);

    const countQuery = Prisma.sql`
      ${searchableCte}
      SELECT COUNT(*)::int as count
      FROM searchable
      WHERE ${matchCondition}
    `;

    const searchQuery = Prisma.sql`
      ${searchableCte}
      SELECT
        s."id",
        ${rankExpression} as rank,
        ts_headline('english', s.description, ${headlineQuery}, 'StartSel=<b>, StopSel=</b>, MaxFragments=2, MaxWords=20, MinWords=5, HighlightAll=true') as snippet,
        s."createdAt",
        s."priceCents"
      FROM searchable s
      WHERE ${matchCondition}
      ORDER BY ${this.buildOrderByClause(params.sort)}
      LIMIT ${cappedPageSize}
      OFFSET ${offset}
    `;

    const [countRows, rows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<{ count: number }[]>(countQuery),
      this.prisma.$queryRaw<{ id: string; rank?: number; snippet?: string | null }[]>(searchQuery),
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

    const rankMap = new Map(rows.map((row) => [row.id, row as { id: string; rank?: number; snippet?: string | null }]));

    const response: ListingSearchResponse = {
      data: ordered.map((listing) => ({
        ...serializeListing(listing),
        relevanceScore: rankMap.get(listing.id)?.rank ?? undefined,
        snippet: rankMap.get(listing.id)?.snippet ?? null,
      })),
      total,
      page,
      pageSize: cappedPageSize,
      pageCount: total === 0 ? 0 : pageCount,
    };
    await this.cache?.set(cacheKey, response, this.cacheTtlMs);
    return response;
  }

  private buildCacheKey(params: ListingSearchParams & { page: number; pageSize: number }): string {
    return `listings:search:${JSON.stringify(params)}`;
  }

  private get cacheTtlMs() {
    const ttlSeconds = Number(this.configService?.get<string>('CACHE_TTL_SECONDS') ?? 30);
    return (Number.isNaN(ttlSeconds) ? 30 : ttlSeconds) * 1000;
  }

  private normalizeStrings(values?: string[]): string[] {
    return (values ?? [])
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());
  }

  private normalizeKeyword(keyword?: string): string {
    return (keyword ?? '').trim().replace(/\s+/g, ' ');
  }

  private buildKeywordQueries(keyword: string) {
    const tokens = keyword.split(' ').filter(Boolean);
    const baseQuery = Prisma.sql`websearch_to_tsquery('english', ${keyword})`;
    const prefixQuery = tokens.length
      ? Prisma.sql`to_tsquery('english', ${tokens.map((token) => `${this.escapeTsQueryToken(token)}:*`).join(' & ')})`
      : undefined;

    const phraseQueries = this.extractPhrases(keyword).map((phrase) =>
      Prisma.sql`phraseto_tsquery('english', ${phrase})`,
    );

    const fallbackQuery = tokens.length ? Prisma.sql`plainto_tsquery('english', ${keyword})` : undefined;
    const similarityTerm = keyword.toLowerCase();

    return {
      tsQueries: { baseQuery, prefixQuery, phraseQueries, fallbackQuery },
      headlineQuery: phraseQueries[0] ?? baseQuery,
      similarityTerm,
    };
  }

  private buildWhereFilter(
    params: ListingSearchParams,
    tagSlugs: string[],
    categorySlugs: string[],
    sellerIds: string[],
  ): Prisma.ListingWhereInput {
    const where: Prisma.ListingWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.moderationStatus ? { moderationStatus: params.moderationStatus } : {}),
      ...(params.sellerId || sellerIds.length
        ? {
            sellerId: sellerIds.length
              ? { in: Array.from(new Set([...sellerIds, ...(params.sellerId ? [params.sellerId] : [])])) }
              : params.sellerId,
          }
        : {}),
      ...(params.createdAfter || params.createdBefore
        ? {
            createdAt: {
              ...(params.createdAfter ? { gte: params.createdAfter } : {}),
              ...(params.createdBefore ? { lte: params.createdBefore } : {}),
            },
          }
        : {}),
      ...(tagSlugs.length
        ? {
            tags: {
              some: {
                tag: { slug: { in: tagSlugs } },
              },
            },
          }
        : {}),
      ...(categorySlugs.length
        ? {
            categories: {
              some: {
                category: { slug: { in: categorySlugs } },
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

  private buildSqlConditions(
    params: ListingSearchParams,
    tagSlugs: string[],
    categorySlugs: string[],
    sellerIds: string[],
  ) {
    const conditions: Prisma.Sql[] = [Prisma.sql`l."deletedAt" IS NULL`];

    if (params.status) {
      conditions.push(Prisma.sql`l."status" = ${params.status}`);
    }
    if (params.moderationStatus) {
      conditions.push(Prisma.sql`l."moderationStatus" = ${params.moderationStatus}`);
    }
    if (params.sellerId || sellerIds.length) {
      const sellers = Array.from(new Set([...sellerIds, ...(params.sellerId ? [params.sellerId] : [])]));
      if (sellers.length === 1) {
        conditions.push(Prisma.sql`l."sellerId" = ${sellers[0]}`);
      } else {
        conditions.push(Prisma.sql`l."sellerId" IN (${Prisma.join(sellers.map((id) => Prisma.sql`${id}`))})`);
      }
    }
    if (params.minPriceCents !== undefined) {
      conditions.push(Prisma.sql`l."priceCents" >= ${params.minPriceCents}`);
    }
    if (params.maxPriceCents !== undefined) {
      conditions.push(Prisma.sql`l."priceCents" <= ${params.maxPriceCents}`);
    }
    if (params.createdAfter) {
      conditions.push(Prisma.sql`l."createdAt" >= ${params.createdAfter}`);
    }
    if (params.createdBefore) {
      conditions.push(Prisma.sql`l."createdAt" <= ${params.createdBefore}`);
    }
    if (tagSlugs.length) {
      conditions.push(Prisma.sql`lt."slug" IN (${Prisma.join(tagSlugs.map((tag) => Prisma.sql`${tag}`))})`);
    }
    if (categorySlugs.length) {
      conditions.push(Prisma.sql`lc."slug" IN (${Prisma.join(categorySlugs.map((slug) => Prisma.sql`${slug}`))})`);
    }

    return conditions;
  }

  private buildSearchableCte(
    params: ListingSearchParams,
    tagSlugs: string[],
    categorySlugs: string[],
    sellerIds: string[],
    keyword: string,
  ) {
    const conditions = this.buildSqlConditions(params, tagSlugs, categorySlugs, sellerIds);
    const whereSql = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const baseDocument = Prisma.sql`
      coalesce(
        l."searchVector",
        setweight(to_tsvector('english', unaccent(coalesce(l."title", ''))), 'A') ||
        setweight(to_tsvector('english', unaccent(coalesce(l."description", ''))), 'B') ||
        setweight(to_tsvector('english', unaccent(coalesce(l."location", ''))), 'C')
      )
    `;

    const document = Prisma.sql`
      ${baseDocument} ||
      setweight(to_tsvector('english', unaccent(coalesce(string_agg(DISTINCT lt."label", ' '), ''))), 'C') ||
      setweight(to_tsvector('english', unaccent(coalesce(string_agg(DISTINCT lc."name", ' '), ''))), 'C')
    `;

    const fuzzyText = Prisma.sql`unaccent(coalesce(l."title", '') || ' ' || coalesce(l."description", '') || ' ' || coalesce(string_agg(DISTINCT lt."label", ' '), '') || ' ' || coalesce(string_agg(DISTINCT lc."name", ' '), ''))`;

    return Prisma.sql`
      WITH searchable AS (
        SELECT
          l."id",
          l."createdAt",
          l."priceCents",
          l."title",
          l."description",
          ${document} as document,
          ${fuzzyText} as fuzzy_text,
          similarity(${fuzzyText}, unaccent(${keyword})) as fuzzy_score
        FROM "Listing" l
        LEFT JOIN "ListingTagAssignment" lta ON lta."listingId" = l."id"
        LEFT JOIN "ListingTag" lt ON lt."id" = lta."tagId"
        LEFT JOIN "ListingCategoryAssignment" lca ON lca."listingId" = l."id"
        LEFT JOIN "ListingCategory" lc ON lc."id" = lca."categoryId"
        ${whereSql}
        GROUP BY l."id", l."createdAt", l."priceCents", l."title", l."description", l."searchVector"
      )
    `;
  }

  private buildSearchCondition(
    tsQueries: {
      baseQuery: Prisma.Sql;
      prefixQuery?: Prisma.Sql;
      phraseQueries: Prisma.Sql[];
      fallbackQuery?: Prisma.Sql;
    },
    similarityTerm: string,
  ) {
    const textConditions: Prisma.Sql[] = [Prisma.sql`document @@ ${tsQueries.baseQuery}`];

    if (tsQueries.prefixQuery) {
      textConditions.push(Prisma.sql`document @@ ${tsQueries.prefixQuery}`);
    }
    if (tsQueries.fallbackQuery) {
      textConditions.push(Prisma.sql`document @@ ${tsQueries.fallbackQuery}`);
    }
    if (tsQueries.phraseQueries.length) {
      textConditions.push(Prisma.sql`document @@ (${Prisma.join(tsQueries.phraseQueries, ' | ')})`);
    }

    const combinedText = textConditions.length ? Prisma.sql`(${Prisma.join(textConditions, ' OR ')})` : Prisma.sql`FALSE`;
    const fuzzyCondition = Prisma.sql`(fuzzy_text % ${similarityTerm})`;

    return Prisma.sql`${combinedText} OR ${fuzzyCondition}`;
  }

  private buildRankExpression(tsQueries: {
    baseQuery: Prisma.Sql;
    prefixQuery?: Prisma.Sql;
    phraseQueries: Prisma.Sql[];
    fallbackQuery?: Prisma.Sql;
  }) {
    const rankParts: Prisma.Sql[] = [Prisma.sql`ts_rank_cd(document, ${tsQueries.baseQuery}, 32)`];
    if (tsQueries.prefixQuery) {
      rankParts.push(Prisma.sql`ts_rank_cd(document, ${tsQueries.prefixQuery}, 8)`);
    }
    if (tsQueries.fallbackQuery) {
      rankParts.push(Prisma.sql`ts_rank_cd(document, ${tsQueries.fallbackQuery}, 4)`);
    }
    if (tsQueries.phraseQueries.length) {
      rankParts.push(Prisma.sql`ts_rank_cd(document, (${Prisma.join(tsQueries.phraseQueries, ' | ')}), 16)`);
    }

    const rankSql = Prisma.sql`${Prisma.join(rankParts, ' + ')} + coalesce(fuzzy_score, 0) * 0.25`;
    return Prisma.sql`(${rankSql})`;
  }

  private buildOrderByClause(sort?: ListingSearchSort) {
    switch (sort) {
      case 'price_asc':
        return Prisma.sql`rank DESC, s."priceCents" ASC, s."createdAt" DESC`;
      case 'price_desc':
        return Prisma.sql`rank DESC, s."priceCents" DESC, s."createdAt" DESC`;
      case 'date_old':
        return Prisma.sql`rank DESC, s."createdAt" ASC`;
      case 'title':
        return Prisma.sql`rank DESC, s."title" ASC`;
      case 'date_new':
      case 'relevance':
      default:
        return Prisma.sql`rank DESC, s."createdAt" DESC`;
    }
  }

  private buildPrismaOrder(sort?: ListingSearchSort): Prisma.ListingOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return [{ priceCents: 'asc' }, { createdAt: 'desc' }];
      case 'price_desc':
        return [{ priceCents: 'desc' }, { createdAt: 'desc' }];
      case 'date_old':
        return [{ createdAt: 'asc' }];
      case 'title':
        return [{ title: 'asc' }, { createdAt: 'desc' }];
      case 'date_new':
        return [{ createdAt: 'desc' }];
      case 'relevance':
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private escapeTsQueryToken(token: string): string {
    return token.replace(/[':]/g, '');
  }

  private extractPhrases(keyword: string): string[] {
    const matches = keyword.match(/"([^"]+)"/g) ?? [];
    return matches.map((match) => match.replace(/"/g, '')).filter(Boolean);
  }
}
