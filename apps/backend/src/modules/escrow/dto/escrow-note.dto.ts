import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EscrowNoteDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string;
}
