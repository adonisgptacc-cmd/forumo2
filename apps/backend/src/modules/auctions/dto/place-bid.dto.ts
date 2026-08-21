import { IsNumber, IsOptional, Min } from "class-validator";

export class PlaceBidDto {
  @IsNumber()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAutoBidCents?: number;
}
