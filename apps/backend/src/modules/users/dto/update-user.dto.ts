import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsPhoneNumber, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

import { KycStatus, UserRole } from '@prisma/client';

class BaseUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsPhoneNumber('ZA', { message: 'phone must be a valid international number' })
  phone?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(KycStatus)
  kycStatus?: KycStatus;
}

export class UpdateUserDto extends PartialType(BaseUserDto) {}
