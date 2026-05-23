import { IsEnum, IsOptional, IsString, IsArray, MaxLength } from 'class-validator';
import { ReturnReason } from '@prisma/client';

export class InitiateReturnDto {
  @IsEnum(ReturnReason)
  declare reason: ReturnReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  conditionNotes?: string;

  @IsOptional()
  @IsArray()
  items?: Array<{ orderItemId: string; quantity: number }>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
