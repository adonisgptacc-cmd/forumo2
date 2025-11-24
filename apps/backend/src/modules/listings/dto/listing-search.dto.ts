import { ListingModerationStatus, ListingStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { ListingSearchSort } from '../search.service.js';

export class ListingSearchQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @IsEnum(ListingModerationStatus)
  moderationStatus?: ListingModerationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPriceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPriceCents?: number;

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const ids = Array.isArray(value) ? value : String(value).split(',');
    return ids.map((id) => String(id).trim()).filter(Boolean);
  })
  sellerIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const tags = Array.isArray(value) ? value : String(value).split(',');
    return tags
      .map((tag) => String(tag).trim())
      .filter(Boolean)
      .map((tag) => tag.toLowerCase());
  })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const categories = Array.isArray(value) ? value : String(value).split(',');
    return categories
      .map((category) => String(category).trim())
      .filter(Boolean)
      .map((category) => category.toLowerCase());
  })
  categories?: string[];

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdAfter?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdBefore?: Date;

  @IsOptional()
  @IsIn(['relevance', 'price_asc', 'price_desc', 'date_new', 'date_old', 'title'])
  sort?: ListingSearchSort;
}
