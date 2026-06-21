import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AddTranscriptDto {
  @IsOptional()
  @IsString()
  participantId?: string;

  @IsString()
  speakerLabel!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  confidence?: number;

  @Type(() => Number)
  @IsNumber()
  startTime!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  endTime?: number;

  @IsOptional()
  @IsString()
  language?: string;
}
