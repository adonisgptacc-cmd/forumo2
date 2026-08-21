import { IsString, MaxLength } from "class-validator";

export class RejectReturnDto {
  @IsString()
  @MaxLength(1000)
  declare reason: string;
}
