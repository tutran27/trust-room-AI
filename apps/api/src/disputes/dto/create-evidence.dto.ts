import { IsString, IsOptional } from 'class-validator';

export class CreateEvidenceDto {
  @IsString()
  type!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  url?: string;
}