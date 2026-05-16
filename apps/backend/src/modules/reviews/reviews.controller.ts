import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateReviewDto, FlagReviewDto, UpdateReviewDto } from "./dto/create-review.dto";
import { ListingReviewResponse, ReviewRollup, SafeReview } from "./review.serializer";
import { ReviewsService } from "./reviews.service";

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(':id')
  findOne(@Param('id') id: string): Promise<SafeReview> {
    return this.reviewsService.findById(id);
  }

  @Get()
  listForListing(
    @Query('listingId') listingId: string,
    @Query('viewerId') viewerId?: string,
  ): Promise<ListingReviewResponse> {
    if (!listingId) {
      throw new BadRequestException('listingId is required');
    }
    return this.reviewsService.listForListing(listingId, viewerId);
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  voteReview(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<{ helpfulCount: number; userVoted: boolean }> {
    return this.reviewsService.voteReview(id, req.user.id);
  }

  @Post(':id/flag')
  @UseGuards(JwtAuthGuard)
  flagReview(
    @Param('id') id: string,
    @Body() dto: FlagReviewDto,
  ): Promise<void> {
    return this.reviewsService.flagReview(id, dto.reason);
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
