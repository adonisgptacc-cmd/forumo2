import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AddDisputeMessageDto {
    @IsString()
    @MinLength(1)
    @MaxLength(2000)
    body!: string;

    @IsOptional()
    attachments?: Record<string, unknown>;
}
