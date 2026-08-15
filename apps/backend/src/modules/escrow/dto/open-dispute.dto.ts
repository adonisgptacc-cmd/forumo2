import { IsString, MaxLength, MinLength } from 'class-validator';

export class OpenDisputeDto {
    @IsString()
    @MinLength(1)
    @MaxLength(1000)
    reason!: string;
}
