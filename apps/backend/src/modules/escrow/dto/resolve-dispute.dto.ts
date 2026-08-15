import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class ResolveDisputeDto {
    @IsString()
    @MinLength(1)
    @MaxLength(1000)
    resolution!: string;

    @IsEnum(['RELEASE', 'REFUND', 'PARTIAL_REFUND'])
    action!: 'RELEASE' | 'REFUND' | 'PARTIAL_REFUND';

    @IsOptional()
    @IsInt()
    @Min(0)
    refundAmountCents?: number;
}
