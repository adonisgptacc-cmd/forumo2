import type { Express } from "express";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  MaxFileSizeValidator,
  ParseFilePipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ListingModerationStatus, ListingStatus } from "@prisma/client";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateListingDto } from "./dto/create-listing.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";
import { SafeListing, SafeListingImage } from "./listing.serializer";
import { ListingsService } from "./listings.service";
import { ListingSearchService } from "./search.service";
import { LocalSearchService } from "./local-search.service";

@Controller("listings")
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly listingSearchService: ListingSearchService,
    private readonly localSearchService: LocalSearchService,
  ) {}

  @Get("nearby")
  searchNearby(
    @Query("lat") lat: string,
    @Query("lng") lng: string,
    @Query("radius") radius: string = "10",
  ) {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    const radiusN = parseFloat(radius);
    if (isNaN(latN) || latN < -90 || latN > 90)
      throw new BadRequestException("lat must be between -90 and 90");
    if (isNaN(lngN) || lngN < -180 || lngN > 180)
      throw new BadRequestException("lng must be between -180 and 180");
    if (isNaN(radiusN) || radiusN <= 0 || radiusN > 500)
      throw new BadRequestException("radius must be between 0 and 500 km");
    return this.localSearchService.searchNearby(latN, lngN, radiusN);
  }

  @Get()
  findAll(): Promise<SafeListing[]> {
    return this.listingsService.findAll();
  }

  @Get("search")
  search(@Query() query: Record<string, unknown>) {
    const toInt = (v: unknown): number | undefined => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const toDate = (v: unknown): Date | undefined => {
      if (!v) return undefined;
      const d = new Date(String(v));
      return isNaN(d.getTime()) ? undefined : d;
    };
    const VALID_SORTS = [
      "relevance",
      "price_asc",
      "price_desc",
      "date_new",
      "date_old",
      "title",
    ] as const;
    type Sort = (typeof VALID_SORTS)[number];
    const toSort = (v: unknown): Sort =>
      VALID_SORTS.includes(v as Sort) ? (v as Sort) : "relevance";

    return this.listingSearchService.search({
      keyword:
        typeof query.keyword === "string"
          ? query.keyword.trim() || undefined
          : undefined,
      page: toInt(query.page) ?? 1,
      pageSize: toInt(query.pageSize) ?? 20,
      status: ListingStatus.PUBLISHED,
      moderationStatus: ListingModerationStatus.APPROVED,
      minPriceCents: toInt(query.minPriceCents),
      maxPriceCents: toInt(query.maxPriceCents),
      sellerId: typeof query.sellerId === "string" ? query.sellerId : undefined,
      sellerIds: query.sellerIds as any,
      tags: query.tags as any,
      categories: query.categories as any,
      createdAfter: toDate(query.createdAfter),
      createdBefore: toDate(query.createdBefore),
      sort: toSort(query.sort),
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<SafeListing> {
    return this.listingsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() dto: CreateListingDto,
    @Request() req: { user: { id: string } },
  ): Promise<SafeListing> {
    return this.listingsService.create(dto, req.user.id);
  }

  @Patch("bulk")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  bulkUpdate(
    @Body() body: { ids: string[]; status: string },
    @Request() req: { user: { id: string } },
  ): Promise<{ updated: number }> {
    const { ids, status } = body;
    if (!Array.isArray(ids) || ids.length === 0)
      throw new BadRequestException("ids must be a non-empty array");
    const validStatuses = ["PUBLISHED", "PAUSED", "DRAFT"];
    if (!validStatuses.includes(status))
      throw new BadRequestException(
        `status must be one of ${validStatuses.join(", ")}`,
      );
    return this.listingsService.bulkUpdateStatus(
      ids,
      status as any,
      req.user.id,
    );
  }

  @Delete("bulk")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  bulkDelete(
    @Body() body: { ids: string[] },
    @Request() req: { user: { id: string } },
  ): Promise<{ deleted: number }> {
    const { ids } = body;
    if (!Array.isArray(ids) || ids.length === 0)
      throw new BadRequestException("ids must be a non-empty array");
    return this.listingsService.bulkDelete(ids, req.user.id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  update(
    @Param("id") id: string,
    @Body() dto: UpdateListingDto,
    @Request() req: { user: { id: string } },
  ): Promise<SafeListing> {
    return this.listingsService.update(id, dto, req.user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  remove(
    @Param("id") id: string,
    @Request() req: { user: { id: string } },
  ): Promise<void> {
    return this.listingsService.softDelete(id, req.user.id);
  }

  @Post(":id/report")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  reportListing(
    @Param("id") id: string,
    @Body() body: { reason: string },
    @Request() req: { user: { id: string } },
  ): Promise<{ message: string }> {
    return this.listingsService.reportListing(
      id,
      req.user.id,
      body.reason ?? "No reason given",
    );
  }

  @Post(":id/images")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  uploadImage(
    @Param("id") id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 8 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Request() req: { user: { id: string } },
  ): Promise<SafeListingImage> {
    return this.listingsService.attachImage(id, file, req.user.id);
  }
}
