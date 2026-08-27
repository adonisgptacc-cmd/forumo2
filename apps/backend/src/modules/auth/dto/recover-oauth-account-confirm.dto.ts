import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
  MinLength,
} from "class-validator";

export class RecoverOAuthAccountConfirmDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      "newPassword must include upper and lower case letters, a number and a special character",
  })
  newPassword!: string;

  @IsOptional()
  @IsPhoneNumber(undefined, {
    message: "phone must be a valid international number (e.g. +27821234567)",
  })
  phone?: string;
}
