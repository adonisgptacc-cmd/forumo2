import { IsInt, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTrustSeedDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  label!: string;

  @IsInt()
  value!: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
