import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Min } from 'class-validator';

export class InviteSellerDto {
  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, { message: 'Invalid Solana wallet address.' })
  sellerWallet!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
