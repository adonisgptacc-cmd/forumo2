import { IsOptional, IsUUID } from 'class-validator';

export class ThreadQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  listingId?: string;
}
