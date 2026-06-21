import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { WalletRiskController } from './wallet-risk.controller';
import { WalletRiskService } from './wallet-risk.service';

@Module({
  imports: [DatabaseModule],
  controllers: [WalletRiskController],
  providers: [WalletRiskService],
  exports: [WalletRiskService],
})
export class WalletRiskModule {}
