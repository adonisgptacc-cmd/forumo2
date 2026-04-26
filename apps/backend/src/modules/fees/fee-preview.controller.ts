import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeeService } from './fee.service';

class FeePreviewQuery {
  @IsUUID()
  listingId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  subtotalCents!: number;
}

@Controller('fees')
@UseGuards(JwtAuthGuard)
export class FeePreviewController {
  constructor(private readonly feeService: FeeService) {}

  @Get('preview')
  preview(@Query() query: FeePreviewQuery) {
    return this.feeService.calculateFee(query.subtotalCents, query.listingId);
  }
}
