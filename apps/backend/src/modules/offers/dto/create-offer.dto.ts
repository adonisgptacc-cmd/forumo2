import { IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateOfferDto {
  @IsUUID()
  listingId!: string;

  @IsNumber()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  message?: string;
}
