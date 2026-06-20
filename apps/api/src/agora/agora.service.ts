import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AgoraStatus } from '@trustroom/db';

@Injectable()
export class AgoraService {
  constructor(private readonly prisma: PrismaService) {}

  async create(wallet: string, title: string, description: string, category: string, tokenMint?: string) {
    return this.prisma.agora.create({
      data: {
        creatorWallet: wallet,
        title,
        description,
        category,
        tokenMint,
        status: AgoraStatus.OPEN,
      },
    });
  }

  async list(status?: AgoraStatus, category?: string) {
    return this.prisma.agora.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getById(id: string) {
    const agora = await this.prisma.agora.findUnique({ where: { id } });
    if (!agora) throw new HttpException('Agora not found', HttpStatus.NOT_FOUND);
    return agora;
  }

  async closeProposal(id: string, wallet: string) {
    const agora = await this.getById(id);
    if (agora.creatorWallet !== wallet) {
      throw new HttpException('Only creator can close proposal', HttpStatus.FORBIDDEN);
    }
    return this.prisma.agora.update({
      where: { id },
      data: { status: AgoraStatus.CLOSED },
    });
  }

  async vote(id: string, wallet: string, support: boolean, amount: number, votePower?: number) {
    const agora = await this.getById(id);
    if (agora.status !== AgoraStatus.OPEN) {
      throw new HttpException('Agora is not open for voting', HttpStatus.BAD_REQUEST);
    }

    // Create vote record
    await this.prisma.vote.create({
      data: {
        agoraId: id,
        wallet,
        support,
        amount,
        votePower: votePower || 1,
      },
    });

    return this.prisma.agora.update({
      where: { id },
      data: {
        totalVotes: { increment: 1 },
        totalStaked: { increment: amount },
      },
    });
  }

  async getVotes(agoraId: string) {
    return this.prisma.vote.findMany({
      where: { agoraId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async tally(agoraId: string) {
    const votes = await this.prisma.vote.findMany({ where: { agoraId } });
    const forVotes = votes.filter(v => v.support).reduce((sum, v) => sum + Number(v.amount), 0);
    const againstVotes = votes.filter(v => !v.support).reduce((sum, v) => sum + Number(v.amount), 0);
    const total = forVotes + againstVotes;
    return {
      total,
      for: forVotes,
      against: againstVotes,
      forPercentage: total > 0 ? (forVotes / total) * 100 : 0,
      againstPercentage: total > 0 ? (againstVotes / total) * 100 : 0,
      voteCount: votes.length,
    };
  }
}