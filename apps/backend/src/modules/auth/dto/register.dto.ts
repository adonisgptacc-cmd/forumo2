import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      "password must include upper and lower case letters, a number and a special character",
  })
  password!: string;

  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: "phone must be E.164 format (+123...)",
  })
  phone!: string;
}
