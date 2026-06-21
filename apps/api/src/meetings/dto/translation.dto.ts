import { IsOptional, IsString } from 'class-validator';

export class AddTranslationDto {
  @IsString()
  transcriptId!: string;

  @IsString()
  targetLanguage!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  provider?: string;
}
