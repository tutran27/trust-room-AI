import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DisputeResolution, DisputeStatus } from '@trustroom/db';
import { DealStatus } from '@trustroom/types';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../database/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { DealsService } from '../deals/deals.service';
import { hashEvidence, hashEvidenceBundle, resolutionToDealStatus } from './disputes.utils';

@Injectable()
export class DisputesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WebsocketGateway) private readonly ws: WebsocketGateway,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(DealsService) private readonly deals: DealsService,
  ) {}

  /** Best-effort: notify every participant of a deal + emit a realtime event. */
  private async notifyDeal(
    dealId: string,
    title: string,
    message: string,
    type: 'DisputeOpened' | 'DisputeResolved',
  ) {
    try {
      const participants = await this.prisma.dealParticipant.findMany({
        where: { dealId },
        select: { walletAddress: true },
      });
      for (const p of participants) {
        const n = await this.notifications.create(p.walletAddress, title, message, type, dealId);
        this.ws.emitNotification(p.walletAddress, {
          id: n.id,
          type,
          title,
          message,
          dealId,
          createdAt: n.createdAt,
        });
      }
    } catch {
      /* best-effort */
    }
  }

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

    const dispute = await this.prisma.dispute.create({
      data: {
        dealId: dto.dealId,
        raisedBy: actorWallet,
        reason: dto.reason,
        aiSummary: dto.description,
      },
      include: { evidence: true },
    });

    try {
      this.ws.emitDisputeUpdate(dispute.id, { dealId: dto.dealId, status: dispute.status, kind: 'opened' });
    } catch {
      /* best-effort */
    }
    void this.notifyDeal(
      dto.dealId,
      'Dispute opened',
      `A dispute was opened: ${dto.reason}.`,
      'DisputeOpened',
    );

    return dispute;
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
        hash: hashEvidence(dto.content, dto.url),
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

  async resolveDispute(actorWallet: string, disputeId: string, dto: ResolveDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { deal: { include: { participants: true } }, evidence: true },
    });

    if (!dispute) {
      throw new AppException(HttpStatus.NOT_FOUND, 'DISPUTE_NOT_FOUND', 'Dispute not found.');
    }

    // RBAC: only a participant of the disputed deal may resolve it. There is no
    // arbitrator role in the schema yet — a dedicated arbitrator/admin role should
    // gate this in a later iteration (see notes). Until then participant-only is
    // the minimum bar that closes the "anyone can resolve" hole.
    if (
      !dispute.deal.participants.some(
        (participant) => participant.walletAddress === actorWallet,
      )
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'DISPUTE_FORBIDDEN',
        'Only deal participants can resolve this dispute.',
      );
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
    const resolution = resolutionMap[dto.resolution];

    // Anchor the full evidence bundle into a single tamper-evident digest at
    // resolution time, recomputing any missing per-item hashes defensively.
    const evidenceHash = hashEvidenceBundle(
      dispute.evidence.map((e) => e.hash ?? hashEvidence(e.content, e.url)),
    );

    const resolved = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.Resolved,
        resolution,
        resolvedAt: new Date(),
      },
      include: { evidence: true, deal: true },
    });

    // Drive the deal FSM into its resolved terminal state. The AI/dispute layer
    // only warns and records — it never touches on-chain escrow here; this is the
    // off-chain state transition (Disputed → ResolvedRelease|Refund|Split).
    const targetStatus = resolutionToDealStatus(resolution);
    try {
      if (dispute.deal.status === DealStatus.Disputed) {
        await this.deals.settleDisputedDeal(resolved.dealId, targetStatus, actorWallet);
      }
      if (evidenceHash) {
        await this.prisma.deal.update({
          where: { id: resolved.dealId },
          data: { evidenceHash },
        });
      }
    } catch {
      /* best-effort: dispute is resolved even if deal settlement raced */
    }

    try {
      this.ws.emitDisputeUpdate(resolved.id, {
        dealId: resolved.dealId,
        status: resolved.status,
        resolution: resolved.resolution,
        kind: 'resolved',
      });
    } catch {
      /* best-effort */
    }
    void this.notifyDeal(
      resolved.dealId,
      'Dispute resolved',
      `Dispute resolved: ${dto.resolution}.`,
      'DisputeResolved',
    );

    return resolved;
  }
}
