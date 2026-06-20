import { IsString, IsOptional } from 'class-validator';

export class CreateAgoraDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  category!: string;

  @IsString()
  @IsOptional()
  tokenMint?: string;
}