import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class VoteAgoraDto {
  @IsBoolean()
  support!: boolean;

  @IsNumber()
  amount!: number;

  @IsNumber()
  @IsOptional()
  votePower?: number;
}