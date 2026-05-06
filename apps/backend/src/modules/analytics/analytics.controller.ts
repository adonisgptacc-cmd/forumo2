import { Controller, Get, ParseIntPipe, Query, Request, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService, GroupBy, Period } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SELLER', 'ADMIN')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('seller/overview')
  getOverview(
    @Request() req: { user: { id: string } },
    @Query('period') period: Period = '30d',
  ) {
    return this.analyticsService.getOverview(req.user.id, period);
  }

  @Get('seller/revenue')
  getRevenue(
    @Request() req: { user: { id: string } },
    @Query('period') period: Period = '30d',
    @Query('groupBy') groupBy: GroupBy = 'day',
  ) {
    return this.analyticsService.getRevenue(req.user.id, period, groupBy);
  }

  @Get('seller/top-listings')
  getTopListings(
    @Request() req: { user: { id: string } },
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 5,
  ) {
    return this.analyticsService.getTopListings(req.user.id, Math.min(limit, 20));
  }

  @Get('seller/reviews-summary')
  getReviewsSummary(@Request() req: { user: { id: string } }) {
    return this.analyticsService.getReviewsSummary(req.user.id);
  }
}
