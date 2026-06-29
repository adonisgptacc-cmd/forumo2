import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class AddItemDto {
  @IsUUID()
  listingId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsString()
  variantLabel?: string;
}
