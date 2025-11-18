import { OtpPurpose } from '@prisma/client';
import { IsEmail, IsEnum, IsIP, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class RequestOtpDto {
  @IsEmail()
  email!: string;

  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @IsString()
  @Length(8, 256)
  deviceFingerprint!: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsIP(undefined, { message: 'ipAddress must be a valid IPv4 or IPv6 address' })
  ipAddress?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
