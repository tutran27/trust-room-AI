import { IsOptional, IsString, Matches, Length } from 'class-validator';

export class CreateEscrowDto {
  @IsString()
  dealId!: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a positive decimal string' })
  amount!: string;

  @IsString()
  @Length(32, 44, { message: 'buyerWallet must be a valid Solana address (32-44 base58 chars)' })
  @Matches(/^[1-9A-HJ-NP-Za-km-z]+$/, { message: 'buyerWallet must be base58 (no 0, O, I, l)' })
  buyerWallet!: string;

  @IsString()
  @Length(32, 44, { message: 'sellerWallet must be a valid Solana address (32-44 base58 chars)' })
  @Matches(/^[1-9A-HJ-NP-Za-km-z]+$/, { message: 'sellerWallet must be base58 (no 0, O, I, l)' })
  sellerWallet!: string;

  @IsOptional()
  @IsString()
  tokenMint?: string;
}
