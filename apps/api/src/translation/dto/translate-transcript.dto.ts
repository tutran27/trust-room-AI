import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';

export class TranslateTranscriptDto {
  @IsString()
  @MaxLength(3000)
  text!: string;

  @IsEnum(['vi', 'en'])
  source_lang!: 'vi' | 'en';

  @IsEnum(['vi', 'en'])
  target_lang!: 'vi' | 'en';

  @IsString()
  meetingId!: string;

  @IsOptional()
  @IsString()
  transcriptId?: string;

  @IsOptional()
  @IsString()
  speakerWallet?: string;

  @IsOptional()
  tts?: boolean;
}