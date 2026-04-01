import { IsString, IsOptional, MaxLength, Matches, IsNotEmpty } from 'class-validator';

export class CreateStorefrontDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    name!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    @Matches(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
    slug!: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;
}
