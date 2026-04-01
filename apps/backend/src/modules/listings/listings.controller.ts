import type { Express } from 'express';
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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateListingDto } from "./dto/create-listing.dto";
import { ListingSearchQueryDto } from "./dto/listing-search.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";
import { SafeListing, SafeListingImage } from "./listing.serializer";
import { ListingsService } from "./listings.service";
import { ListingSearchService } from "./search.service";
import { LocalSearchService } from "./local-search.service";

@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly listingSearchService: ListingSearchService,
    private readonly localSearchService: LocalSearchService,
  ) { }

  @Get('nearby')
  searchNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius: string = '10',
  ) {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    const radiusN = parseFloat(radius);
    if (isNaN(latN) || latN < -90 || latN > 90) throw new BadRequestException('lat must be between -90 and 90');
    if (isNaN(lngN) || lngN < -180 || lngN > 180) throw new BadRequestException('lng must be between -180 and 180');
    if (isNaN(radiusN) || radiusN <= 0 || radiusN > 500) throw new BadRequestException('radius must be between 0 and 500 km');
    return this.localSearchService.searchNearby(latN, lngN, radiusN);
  }

  @Get()
  findAll(): Promise<SafeListing[]> {
    return this.listingsService.findAll();
  }

  @Get('search')
  search(@Query() query: ListingSearchQueryDto) {
    return this.listingSearchService.search({
      keyword: query.keyword?.trim() || undefined,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      status: query.status,
      moderationStatus: query.moderationStatus,
      minPriceCents: query.minPriceCents,
      maxPriceCents: query.maxPriceCents,
      sellerId: query.sellerId,
      sellerIds: query.sellerIds,
      tags: query.tags,
      categories: query.categories,
      createdAfter: query.createdAfter,
      createdBefore: query.createdBefore,
      sort: query.sort ?? 'relevance',
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<SafeListing> {
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

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
    @Request() req: { user: { id: string } },
  ): Promise<SafeListing> {
    return this.listingsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ): Promise<void> {
    return this.listingsService.softDelete(id, req.user.id);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @Param('id') id: string,
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
