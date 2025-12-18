import type { Express } from 'express';
import {
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
  UploadedFile,
  UseInterceptors,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CreateListingDto } from "./dto/create-listing.dto";
import { ListingSearchQueryDto } from "./dto/listing-search.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";
import { SafeListing, SafeListingImage } from "./listing.serializer";
import { ListingsService } from "./listings.service";
import { ListingSearchService } from "./search.service";

@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly listingSearchService: ListingSearchService,
  ) {}

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
  create(@Body() dto: CreateListingDto): Promise<SafeListing> {
    return this.listingsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateListingDto): Promise<SafeListing> {
    return this.listingsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.listingsService.softDelete(id);
  }

  @Post(':id/images')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 8 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ): Promise<SafeListingImage> {
    return this.listingsService.attachImage(id, file);
  }
}
