import {
  IsBoolean,
  IsIP,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from "class-validator";

export class LoginDto {
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;

  @IsOptional()
  @IsString()
  @Length(8, 256)
  deviceFingerprint?: string;

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
