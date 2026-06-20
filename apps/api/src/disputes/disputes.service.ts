import { HttpStatus, Injectable } from '@nestjs/common';
import { DisputeResolution, DisputeStatus } from '@trustroom/db';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../database/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  async createDispute(actorWallet: string, dto: CreateDisputeDto) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dto.dealId },
      include: { participants: true },
    });

    if (!deal) {
      throw new AppException(HttpStatus.NOT_FOUND, 'DEAL_NOT_FOUND', 'Deal not found.');
    }

    if (!deal.participants.some((participant) => participant.walletAddress === actorWallet)) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'DISPUTE_FORBIDDEN',
        'Only deal participants can open disputes.',
      );
    }

    const existingDispute = await this.prisma.dispute.findFirst({
      where: { dealId: dto.dealId, status: { not: DisputeStatus.Resolved } },
    });

    if (existingDispute) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'DISPUTE_ALREADY_OPEN',
        'An active dispute already exists for this deal.',
      );
    }

    return this.prisma.dispute.create({
      data: {
        dealId: dto.dealId,
        raisedBy: actorWallet,
        reason: dto.reason,
        aiSummary: dto.description,
      },
      include: { evidence: true },
    });
  }

  async addEvidence(actorWallet: string, disputeId: string, dto: CreateEvidenceDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { deal: { include: { participants: true } } },
    });

    if (!dispute) {
      throw new AppException(HttpStatus.NOT_FOUND, 'DISPUTE_NOT_FOUND', 'Dispute not found.');
    }

    if (!dispute.deal.participants.some((participant) => participant.walletAddress === actorWallet)) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'DISPUTE_FORBIDDEN',
        'Only deal participants can attach evidence.',
      );
    }

    return this.prisma.evidence.create({
      data: {
        disputeId,
        type: dto.type,
        content: dto.content,
        url: dto.url,
      },
    });
  }

  async getDisputeById(actorWallet: string, disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { evidence: true, deal: { include: { participants: true } } },
    });

    if (!dispute) {
      throw new AppException(HttpStatus.NOT_FOUND, 'DISPUTE_NOT_FOUND', 'Dispute not found.');
    }

    if (!dispute.deal.participants.some((participant) => participant.walletAddress === actorWallet)) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'DISPUTE_FORBIDDEN',
        'Only deal participants can view this dispute.',
      );
    }

    return dispute;
  }

  async listDisputes(actorWallet: string) {
    return this.prisma.dispute.findMany({
      where: {
        OR: [
          { raisedBy: actorWallet },
          { deal: { participants: { some: { walletAddress: actorWallet } } } },
        ],
      },
      include: { deal: true, evidence: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveDispute(disputeId: string, dto: ResolveDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new AppException(HttpStatus.NOT_FOUND, 'DISPUTE_NOT_FOUND', 'Dispute not found.');
    }

    if (dispute.status === DisputeStatus.Resolved) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'DISPUTE_ALREADY_RESOLVED',
        'Dispute is already resolved.',
      );
    }

    const resolutionMap: Record<ResolveDisputeDto['resolution'], DisputeResolution> = {
      ReleaseToSeller: DisputeResolution.ReleaseToSeller,
      RefundToBuyer: DisputeResolution.RefundToBuyer,
      SplitPayment: DisputeResolution.SplitPayment,
    };

    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.Resolved,
        resolution: resolutionMap[dto.resolution],
        resolvedAt: new Date(),
      },
      include: { evidence: true, deal: true },
    });
  }
}
