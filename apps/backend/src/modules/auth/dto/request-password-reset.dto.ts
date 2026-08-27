import {
  IsIP,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from "class-validator";

export class RequestPasswordResetDto {
  @IsString()
  @MinLength(3)
  identifier!: string;

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
}
