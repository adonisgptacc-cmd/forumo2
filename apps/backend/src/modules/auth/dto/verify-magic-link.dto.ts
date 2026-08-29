import { IsString, Length } from "class-validator";

export class VerifyMagicLinkDto {
  @IsString()
  @Length(10, 512)
  token!: string;
}
