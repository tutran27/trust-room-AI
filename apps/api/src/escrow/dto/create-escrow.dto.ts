import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Create-escrow payload. Kept minimal to match what the simulated escrow stores.
 * `amount` is a decimal string to avoid float precision loss.
 */
export class CreateEscrowDto {
  @IsString()
  dealId!: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a positive decimal string' })
  amount!: string;

  @IsString()
  sellerWallet!: string;

  @IsOptional()
  @IsString()
  buyerWallet?: string;
}
