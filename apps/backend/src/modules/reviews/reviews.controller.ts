import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CreateReviewDto, UpdateReviewDto } from './dto/create-review.dto.js';
import { ListingReviewResponse, ReviewRollup, SafeReview } from './review.serializer.js';
import { ReviewsService } from './reviews.service.js';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(':id')
  findOne(@Param('id') id: string): Promise<SafeReview> {
    return this.reviewsService.findById(id);
  }

  @Get()
  listForListing(@Query('listingId') listingId: string): Promise<ListingReviewResponse> {
    if (!listingId) {
      throw new BadRequestException('listingId is required');
    }
    return this.reviewsService.listForListing(listingId);
  }

  @Get('/seller/:sellerId/rollup')
  rollup(@Param('sellerId') sellerId: string): Promise<ReviewRollup> {
    return this.reviewsService.getRollup(sellerId);
  }

  @Post()
  create(@Body() dto: CreateReviewDto): Promise<SafeReview> {
    return this.reviewsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto): Promise<SafeReview> {
    return this.reviewsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.reviewsService.remove(id);
  }
}
