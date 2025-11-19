import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;
}
