import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';

export class CreateInviteDto {
  @IsOptional()
  @IsString()
  walletAddress?: string;

  @IsEnum(['buyer', 'seller', 'arbiter', 'guest'] as const)
  role: 'buyer' | 'seller' | 'arbiter' | 'guest' = 'guest';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxUses?: number;

  @IsDateString()
  expiresAt!: string;
}

export class JoinByTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
