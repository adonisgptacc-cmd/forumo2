import { ReviewStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  reviewerId!: string;

  @IsString()
  @IsNotEmpty()
  recipientId!: string;

  @IsString()
  @IsNotEmpty()
  listingId!: string;

  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateReviewDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
