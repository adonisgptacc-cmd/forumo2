import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RefundEscrowDto {
    @IsOptional()
    @IsInt()
    @Min(0)
    amountCents?: number;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string;
}
