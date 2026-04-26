import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class AddItemDto {
  @IsUUID()
  listingId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
