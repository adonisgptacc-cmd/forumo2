import { IsNumber, IsOptional, IsUUID, Min } from "class-validator";

export class CreateAuctionDto {
  @IsUUID()
  listingId!: string;

  @IsNumber()
  @Min(0)
  startingBidCents!: number;

  @IsNumber()
  @Min(1)
  durationDays!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reserveCents?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  buyNowCents?: number;
}
