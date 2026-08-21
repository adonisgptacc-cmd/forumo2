import { IsInt, Max, Min } from "class-validator";

export class UpdateQuantityDto {
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
