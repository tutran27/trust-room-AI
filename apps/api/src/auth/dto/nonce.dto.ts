import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

export class NonceRequestDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  walletAddress!: string;
}

export class NonceResponseDto {
  challengeId!: string;
  nonce!: string;
  message!: string;
  expiresAt!: string;
}
