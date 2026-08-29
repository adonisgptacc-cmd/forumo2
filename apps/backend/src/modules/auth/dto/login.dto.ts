import {
  IsBoolean,
  IsEmail,
  IsIP,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from "class-validator";

export class LoginDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(3, 254)
  identifier?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(1)
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
