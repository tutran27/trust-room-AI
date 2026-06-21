import { IsOptional, IsString } from 'class-validator';

export class AddRiskEventDto {
  @IsOptional()
  @IsString()
  transcriptId?: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsString()
  description!: string;
}
