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

import { CreateListingDto } from './dto/create-listing.dto.js';
import { ListingSearchQueryDto } from './dto/listing-search.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { SafeListing, SafeListingImage } from './listing.serializer.js';
import { ListingsService } from './listings.service.js';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  findAll(): Promise<SafeListing[]> {
    return this.listingsService.findAll();
  }

  @Get('search')
  search(@Query() query: ListingSearchQueryDto) {
    return this.listingsService.searchListings({
      keyword: query.keyword?.trim() || undefined,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      status: query.status,
      minPriceCents: query.minPriceCents,
      maxPriceCents: query.maxPriceCents,
      sellerId: query.sellerId,
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
