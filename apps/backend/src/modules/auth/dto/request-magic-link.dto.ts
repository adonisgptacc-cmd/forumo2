import { IsString, Length } from "class-validator";

export class RequestMagicLinkDto {
  @IsString()
  @Length(3, 254)
  identifier!: string;
}
