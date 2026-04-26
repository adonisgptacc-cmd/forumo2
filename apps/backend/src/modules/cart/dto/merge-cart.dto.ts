import { Type } from 'class-transformer';
import { IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

class GuestCartItemDto {
  @IsUUID()
  listingId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class MergeCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestCartItemDto)
  items!: GuestCartItemDto[];
}
