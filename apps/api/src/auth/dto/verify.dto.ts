import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

export class VerifyRequestDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  challengeId!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  walletAddress!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nonce!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  signature!: string;
}

export class VerifyResponseDto {
  accessToken!: string;
  userId!: string;
  walletAddress!: string;
}
