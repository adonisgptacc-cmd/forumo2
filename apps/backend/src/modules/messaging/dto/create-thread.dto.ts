import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { MessageParticipantRole } from '@prisma/client';

import { SendMessageDto } from "./send-message.dto";

export class ThreadParticipantDto {
  @IsUUID()
  userId!: string;

  @IsEnum(MessageParticipantRole)
  role!: MessageParticipantRole;
}

export class CreateThreadDto {
  @IsOptional()
  @IsUUID()
  listingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ThreadParticipantDto)
  participants!: ThreadParticipantDto[];

  @IsOptional()
  metadata?: Record<string, unknown> | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => SendMessageDto)
  initialMessage?: SendMessageDto;
}
