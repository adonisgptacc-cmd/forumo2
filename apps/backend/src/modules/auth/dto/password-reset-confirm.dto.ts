import { NotificationChannel } from '@prisma/client';
import { IsEmail, IsEnum, IsIP, IsObject, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class PasswordResetConfirmDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

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

  @IsString()
  @MinLength(12)
  newPassword!: string;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}
