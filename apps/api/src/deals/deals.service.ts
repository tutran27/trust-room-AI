import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, ParticipantRole } from '@trustroom/db';
import { DealEvent, DealStatus, canTransition } from '@trustroom/types';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../database/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { InviteSellerDto } from './dto/invite-seller.dto';
import { ListDealsDto } from './dto/list-deals.dto';
import { TransitionDealDto } from './dto/transition-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import {
  amountToString,
  decodeCursor,
  encodeCursor,
  getEventForAction,
  getTargetStatusForAction,
} from './deals.utils';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { ReputationService } from '../reputation/reputation.service';

@Injectable()
export class DealsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WebsocketGateway) private readonly ws: WebsocketGateway,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(ReputationService)
    private readonly reputation: ReputationService,
  ) {}

  async create(dto: CreateDealDto, actorWallet: string) {
    const participants: Array<{ walletAddress: string; role: ParticipantRole }> = [
      { walletAddress: actorWallet, role: 'buyer' },
    ];

    if (dto.sellerWallet) {
      if (dto.sellerWallet === actorWallet) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'PARTICIPANT_CONFLICT',
          'Seller wallet cannot match the buyer wallet.',
        );
      }
      participants.push({ walletAddress: dto.sellerWallet, role: 'seller' });
    }

    const deal = await this.prisma.deal.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        amount: new Prisma.Decimal(dto.amount),
        token: dto.token,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        participants: {
          create: participants,
        },
        events: {
          create: {
            actorWallet,
            type: DealEvent.DealCreated,
            metadata: { title: dto.title, type: dto.type },
          },
        },
      },
      include: { participants: true, events: { orderBy: { createdAt: 'asc' } } },
    });

    return this.serializeDeal(deal);
  }

  async findAll(actorWallet: string, query: ListDealsDto) {
    const limit = query.limit ?? 20;
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    const deals = await this.prisma.deal.findMany({
      where: {
        participants: { some: { walletAddress: actorWallet } },
        ...(query.status ? { status: query.status } : {}),
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: cursor.updatedAt } },
                { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        participants: true,
      },
    });

    const hasNextPage = deals.length > limit;
    const page = hasNextPage ? deals.slice(0, limit) : deals;

    return {
      data: page.map((deal) => this.serializeDeal(deal)),
      meta: {
        limit,
        nextCursor: hasNextPage
          ? encodeCursor({
              updatedAt: page[page.length - 1]!.updatedAt,
              id: page[page.length - 1]!.id,
            })
          : null,
      },
    };
  }

  async findOne(dealId: string, actorWallet: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        participants: true,
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!deal) {
      throw new AppException(HttpStatus.NOT_FOUND, 'DEAL_NOT_FOUND', 'Deal not found.');
    }

    this.assertParticipant(deal.participants, actorWallet);
    return this.serializeDeal(deal);
  }

  async update(dealId: string, dto: UpdateDealDto, actorWallet: string) {
    const current = await this.loadAuthorizedDeal(dealId, actorWallet);
    this.assertBuyer(current.participants, actorWallet);

    if (
      current.status !== DealStatus.Draft &&
      current.status !== DealStatus.Created
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'DEAL_STATUS_INVALID',
        `Cannot update a deal in status ${current.status}.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.deal.updateMany({
        where: {
          id: dealId,
          version: dto.expectedVersion,
          status: current.status,
        },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
          ...(dto.deadline !== undefined
            ? { deadline: dto.deadline ? new Date(dto.deadline) : null }
            : {}),
          version: { increment: 1 },
        },
      });

      if (result.count !== 1) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'DEAL_VERSION_CONFLICT',
          'Deal version conflict.',
        );
      }

      await tx.dealEvent.create({
        data: {
          dealId,
          actorWallet,
          type: DealEvent.DealUpdated,
          metadata: {
            fields: Object.keys(dto).filter((key) => key !== 'expectedVersion'),
          },
        },
      });

      return tx.deal.findUniqueOrThrow({
        where: { id: dealId },
        include: {
          participants: true,
          events: { orderBy: { createdAt: 'asc' } },
        },
      });
    });

    return this.serializeDeal(updated);
  }

  async inviteSeller(dealId: string, dto: InviteSellerDto, actorWallet: string) {
    const current = await this.loadAuthorizedDeal(dealId, actorWallet);
    this.assertBuyer(current.participants, actorWallet);

    const existingSeller = current.participants.find((participant) => participant.role === 'seller');
    if (existingSeller) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'SELLER_ALREADY_INVITED',
        'Seller has already been invited.',
      );
    }

    if (dto.sellerWallet === actorWallet) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'PARTICIPANT_CONFLICT',
        'Seller wallet cannot match the buyer wallet.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.deal.updateMany({
        where: {
          id: dealId,
          version: dto.expectedVersion,
        },
        data: {
          version: { increment: 1 },
        },
      });

      if (result.count !== 1) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'DEAL_VERSION_CONFLICT',
          'Deal version conflict.',
        );
      }

      await tx.dealParticipant.create({
        data: {
          dealId,
          walletAddress: dto.sellerWallet,
          role: 'seller',
        },
      });

      await tx.dealEvent.create({
        data: {
          dealId,
          actorWallet,
          type: DealEvent.DealSellerInvited,
          metadata: { sellerWallet: dto.sellerWallet },
        },
      });

      return tx.deal.findUniqueOrThrow({
        where: { id: dealId },
        include: {
          participants: true,
          events: { orderBy: { createdAt: 'asc' } },
        },
      });
    });

    return this.serializeDeal(updated);
  }

  async transition(dealId: string, dto: TransitionDealDto, actorWallet: string) {
    const current = await this.loadAuthorizedDeal(dealId, actorWallet);
    this.assertBuyer(current.participants, actorWallet);

    const targetStatus = getTargetStatusForAction(current.status, dto.action);
    if (!targetStatus || !canTransition(current.status, targetStatus)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'DEAL_TRANSITION_INVALID',
        `Action ${dto.action} is invalid from status ${current.status}.`,
      );
    }

    if (
      dto.action === 'verify-wallets' &&
      current.participants.filter((participant) => participant.role === 'seller').length !== 1
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'DEAL_PRECONDITION_FAILED',
        'A seller must be invited before wallet verification.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.deal.updateMany({
        where: {
          id: dealId,
          version: dto.expectedVersion,
          status: current.status,
        },
        data: {
          status: targetStatus,
          version: { increment: 1 },
        },
      });

      if (result.count !== 1) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'DEAL_VERSION_CONFLICT',
          'Deal version conflict.',
        );
      }

      await tx.dealEvent.create({
        data: {
          dealId,
          actorWallet,
          type: getEventForAction(dto.action),
          metadata: {
            from: current.status,
            to: targetStatus,
            reason: dto.reason ?? null,
          },
        },
      });

      return tx.deal.findUniqueOrThrow({
        where: { id: dealId },
        include: {
          participants: true,
          events: { orderBy: { createdAt: 'asc' } },
        },
      });
    });

    const serialized = this.serializeDeal(updated);
    void this.afterTransition(updated, current.status, targetStatus);
    return serialized;
  }

  /**
   * Best-effort side-effects after a successful deal transition: broadcast a
   * realtime `deal_update`, notify participants, and update reputation when the
   * deal reaches a terminal state. Failures here never affect the API response.
   */
  private async afterTransition(
    deal: {
      id: string;
      status: DealStatus;
      participants: Array<{ walletAddress: string; role: ParticipantRole }>;
    },
    from: DealStatus,
    to: DealStatus,
  ) {
    try {
      this.ws.emitDealUpdate(deal.id, { kind: 'status', from, to, status: to });
    } catch {
      /* best-effort */
    }

    for (const p of deal.participants) {
      try {
        const n = await this.notifications.create(
          p.walletAddress,
          'Deal updated',
          `Deal status changed: ${from} → ${to}.`,
          'DealStatusChanged',
          deal.id,
        );
        this.ws.emitNotification(p.walletAddress, {
          id: n.id,
          type: 'DealStatusChanged',
          title: 'Deal updated',
          message: `Deal status changed: ${from} → ${to}.`,
          dealId: deal.id,
          createdAt: n.createdAt,
        });
      } catch {
        /* best-effort */
      }
    }

    // Reputation: completed on Released, disputed on Disputed.
    try {
      if (to === DealStatus.Released) {
        for (const p of deal.participants) {
          await this.reputation.incrementCompletedDeals(p.walletAddress, true);
          await this.reputation.recalculateScore(p.walletAddress);
        }
      } else if (to === DealStatus.Disputed) {
        for (const p of deal.participants) {
          await this.reputation.incrementDisputedDeals(p.walletAddress);
          await this.reputation.recalculateScore(p.walletAddress);
        }
      }
    } catch {
      /* best-effort */
    }
  }

  async cancel(
    dealId: string,
    expectedVersion: number,
    actorWallet: string,
    reason?: string,
  ) {
    return this.transition(
      dealId,
      { action: 'cancel', expectedVersion, reason },
      actorWallet,
    );
  }

  private async loadAuthorizedDeal(dealId: string, actorWallet: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        participants: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!deal) {
      throw new AppException(HttpStatus.NOT_FOUND, 'DEAL_NOT_FOUND', 'Deal not found.');
    }

    this.assertParticipant(deal.participants, actorWallet);
    return deal;
  }

  private assertParticipant(
    participants: Array<{ walletAddress: string }>,
    actorWallet: string,
  ) {
    if (!participants.some((participant) => participant.walletAddress === actorWallet)) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'DEAL_FORBIDDEN',
        'You are not a participant in this deal.',
      );
    }
  }

  private assertBuyer(
    participants: Array<{ walletAddress: string; role: ParticipantRole }>,
    actorWallet: string,
  ) {
    const buyer = participants.find((participant) => participant.role === 'buyer');
    if (!buyer || buyer.walletAddress !== actorWallet) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'DEAL_FORBIDDEN',
        'Only the buyer can perform this action.',
      );
    }
  }

  private serializeDeal(
    deal: {
      id: string;
      title: string;
      description: string | null;
      type: string;
      amount: Prisma.Decimal;
      token: string;
      status: DealStatus;
      deadline: Date | null;
      termsHash: string | null;
      evidenceHash: string | null;
      version: number;
      createdAt: Date;
      updatedAt: Date;
      participants: Array<{ walletAddress: string; role: ParticipantRole }>;
      events?: Array<{
        id: string;
        actorWallet: string;
        type: string;
        metadata: Prisma.JsonValue | null;
        createdAt: Date;
      }>;
    },
  ) {
    const buyer = deal.participants.find((participant) => participant.role === 'buyer');
    const seller = deal.participants.find((participant) => participant.role === 'seller');

    return {
      id: deal.id,
      title: deal.title,
      description: deal.description,
      type: deal.type,
      amount: amountToString(deal.amount),
      token: deal.token,
      status: deal.status,
      deadline: deal.deadline?.toISOString() ?? null,
      termsHash: deal.termsHash,
      evidenceHash: deal.evidenceHash,
      buyerWallet: buyer?.walletAddress ?? null,
      sellerWallet: seller?.walletAddress ?? null,
      version: deal.version,
      createdAt: deal.createdAt.toISOString(),
      updatedAt: deal.updatedAt.toISOString(),
      participants: deal.participants,
      ...(deal.events
        ? {
            events: deal.events.map((event) => ({
              id: event.id,
              actorWallet: event.actorWallet,
              type: event.type,
              metadata: event.metadata,
              createdAt: event.createdAt.toISOString(),
            })),
          }
        : {}),
    };
  }
}
