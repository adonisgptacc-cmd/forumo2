import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AuthRequest } from "../../common/types/auth-request";
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
    @Request() req: AuthRequest,
  ): Promise<{ helpfulCount: number; userVoted: boolean }> {
    return this.reviewsService.voteReview(id, req.user.id);
  }

  @Post(':id/flag')
  @UseGuards(JwtAuthGuard)
  flagReview(
    @Param('id') id: string,
    @Body() dto: FlagReviewDto,
    @Request() req: AuthRequest,
  ): Promise<void> {
    return this.reviewsService.flagReview(id, dto.reason, req.user.id);
  }

  @Get('/seller/:sellerId/rollup')
  rollup(@Param('sellerId') sellerId: string): Promise<ReviewRollup> {
    return this.reviewsService.getRollup(sellerId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateReviewDto, @Request() req: any): Promise<SafeReview> {
    // reviewerId is taken from the authenticated token, never the request body.
    return this.reviewsService.create(dto, req.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @Request() req: AuthRequest,
  ): Promise<SafeReview> {
    return this.reviewsService.update(id, dto, { id: req.user.id, role: req.user.role });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Request() req: any): Promise<void> {
    return this.reviewsService.remove(id, { id: req.user.id, role: req.user.role });
  }
}
