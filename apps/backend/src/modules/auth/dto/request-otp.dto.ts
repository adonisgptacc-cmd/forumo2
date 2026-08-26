import { NotificationChannel, OtpPurpose } from "@prisma/client";
import {
  IsEnum,
  IsIP,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from "class-validator";

export class RequestOtpDto {
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @IsString()
  @Length(8, 256)
  deviceFingerprint!: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsIP(undefined, {
    message: "ipAddress must be a valid IPv4 or IPv6 address",
  })
  ipAddress?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}
