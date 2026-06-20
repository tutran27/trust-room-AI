import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReputationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOrCreate(wallet: string) {
    let rep = await this.prisma.reputation.findUnique({ where: { wallet } });
    if (!rep) {
      rep = await this.prisma.reputation.create({ data: { wallet } });
    }
    return rep;
  }

  async getByWallet(wallet: string) {
    return this.getOrCreate(wallet);
  }

  async incrementCompletedDeals(wallet: string, successful: boolean) {
    await this.getOrCreate(wallet);
    return this.prisma.reputation.update({
      where: { wallet },
      data: {
        completedDeals: { increment: 1 },
        ...(successful ? { successfulDeals: { increment: 1 } } : {}),
        lastUpdated: new Date(),
      },
    });
  }

  async incrementDisputedDeals(wallet: string) {
    await this.getOrCreate(wallet);
    return this.prisma.reputation.update({
      where: { wallet },
      data: {
        disputedDeals: { increment: 1 },
        lastUpdated: new Date(),
      },
    });
  }

  async addVolume(wallet: string, amount: number) {
    await this.getOrCreate(wallet);
    return this.prisma.reputation.update({
      where: { wallet },
      data: {
        totalVolume: { increment: amount },
        lastUpdated: new Date(),
      },
    });
  }

  async recalculateScore(wallet: string) {
    const rep = await this.getOrCreate(wallet);
    const completed = rep.completedDeals || 0;
    const successful = rep.successfulDeals || 0;
    const disputed = rep.disputedDeals || 0;

    // Score formula: base on success rate, penalize disputes
    const successRate = completed > 0 ? successful / completed : 0;
    const disputePenalty = completed > 0 ? (disputed / completed) * 0.5 : 0;
    const volumeBonus = Math.min(Number(rep.totalVolume) / 10000, 0.2);
    const score = Math.max(0, Math.min(1, successRate - disputePenalty + volumeBonus));

    return this.prisma.reputation.update({
      where: { wallet },
      data: { score, lastUpdated: new Date() },
    });
  }

  async getLeaderboard(limit = 20) {
    return this.prisma.reputation.findMany({
      orderBy: { score: 'desc' },
      take: limit,
    });
  }
}
