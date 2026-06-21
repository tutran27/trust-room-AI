import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getWalletOnChainActivity, type WalletOnChainActivity } from '@trustroom/solana';
import { PrismaService } from '../database/prisma.service';
import {
  scoreWalletRisk,
  type WalletInternalHistory,
  type WalletRiskResult,
} from './wallet-risk.scoring';

@Injectable()
export class WalletRiskService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  /** Read the wallet's TrustRoom AI deal footprint from Reputation + DealParticipant. */
  async getInternalHistory(wallet: string): Promise<WalletInternalHistory> {
    const [reputation, participatedDeals] = await Promise.all([
      this.prisma.reputation.findUnique({ where: { wallet } }),
      this.prisma.dealParticipant.count({ where: { walletAddress: wallet } }),
    ]);

    return {
      completedDeals: reputation?.completedDeals ?? 0,
      successfulDeals: reputation?.successfulDeals ?? 0,
      disputedDeals: reputation?.disputedDeals ?? 0,
      participatedDeals,
    };
  }

  /** Best-effort on-chain lookup; never throws (degrades to internal-only scoring). */
  async getOnChainActivity(wallet: string): Promise<WalletOnChainActivity> {
    const rpcUrl = this.config.get<string>('SOLANA_RPC_URL');
    return getWalletOnChainActivity(wallet, { rpcUrl });
  }

  /** Full additive, explainable wallet-risk assessment. */
  async assess(wallet: string): Promise<WalletRiskResult> {
    const [history, activity] = await Promise.all([
      this.getInternalHistory(wallet),
      this.getOnChainActivity(wallet),
    ]);

    return scoreWalletRisk(wallet, history, activity);
  }
}
