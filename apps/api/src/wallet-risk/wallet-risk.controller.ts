import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  UseGuards,
} from '@nestjs/common';
import { isValidAddress } from '@trustroom/solana';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WalletRiskService } from './wallet-risk.service';

@Controller('wallet-risk')
@UseGuards(JwtAuthGuard)
export class WalletRiskController {
  constructor(
    @Inject(WalletRiskService) private readonly walletRiskService: WalletRiskService,
  ) {}

  @Get(':wallet')
  async getRisk(@Param('wallet') wallet: string) {
    if (!wallet || !isValidAddress(wallet)) {
      throw new BadRequestException('Invalid Solana wallet address');
    }
    return this.walletRiskService.assess(wallet);
  }
}
