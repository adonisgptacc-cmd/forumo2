import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

import { AtLeastOneIdentifier } from "../validators/at-least-one-identifier.validator";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Attached to `password` rather than `email`/`phone`: class-validator's
  // @IsOptional() on those fields would skip this cross-field check too
  // whenever the value is absent — exactly the case this constraint exists
  // to catch. `password` is never @IsOptional(), so the check always runs.
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      "password must include upper and lower case letters, a number and a special character",
  })
  @AtLeastOneIdentifier()
  password!: string;

  @IsOptional()
  @IsPhoneNumber(undefined, {
    message: "phone must be a valid international number (e.g. +27821234567)",
  })
  phone?: string;
}
