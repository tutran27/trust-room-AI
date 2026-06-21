import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  runRules,
  aggregateFullRisk,
  repetitionPenalty,
  type RuleHit,
} from '@trustroom/ai';
import { type DealStatus, type ScamIntent } from '@trustroom/types';
import { NotificationsService } from '../notifications/notifications.service';

interface ChatMessagePayload {
  dealId: string;
  message: string;
  sender: string;
  speakerRole?: 'buyer' | 'seller' | 'ai' | 'system';
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  /**
   * Recent dangerous intents per deal, kept in memory to power the repetition
   * penalty. Bounded per deal so a long-lived room can't grow unbounded. This is
   * best-effort signal only — losing it on restart just resets the penalty.
   */
  private readonly recentIntents = new Map<string, ScamIntent[]>();
  private static readonly INTENT_HISTORY_CAP = 50;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_deal')
  handleJoinDeal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { dealId: string; wallet?: string },
  ) {
    client.join(`deal:${data.dealId}`);
    if (data.wallet) client.join(`user:${data.wallet}`);
    this.logger.log(`Client ${client.id} joined deal:${data.dealId}`);
    return { event: 'joined', data: { dealId: data.dealId } };
  }

  @SubscribeMessage('leave_deal')
  handleLeaveDeal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { dealId: string },
  ) {
    client.leave(`deal:${data.dealId}`);
    return { event: 'left', data: { dealId: data.dealId } };
  }

  /**
   * A chat / transcript message in a deal room. Broadcasts the message AND runs it
   * through the deterministic Scam Guard. Any risk that fires is broadcast as a
   * `risk_detected` event (powering the realtime AI Monitor panel), persisted to the
   * deal timeline, and surfaced as a notification. All persistence is best-effort —
   * a DB hiccup never drops the realtime message.
   */
  @SubscribeMessage('chat_message')
  async handleChatMessage(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: ChatMessagePayload,
  ) {
    const room = `deal:${data.dealId}`;
    const timestamp = new Date().toISOString();

    this.server.to(room).emit('chat_message', {
      dealId: data.dealId,
      message: data.message,
      sender: data.sender,
      speakerRole: data.speakerRole ?? 'buyer',
      timestamp,
    });

    await this.runScamGuard(data, timestamp);
    return { event: 'message_sent' };
  }

  private async runScamGuard(data: ChatMessagePayload, timestamp: string) {
    let dealStatus: DealStatus = 'Negotiating' as DealStatus;
    const knownWallets: string[] = [];
    try {
      const deal = await this.prisma.deal.findUnique({
        where: { id: data.dealId },
        select: {
          status: true,
          participants: { select: { walletAddress: true } },
          escrow: { select: { sellerAddress: true } },
        },
      });
      if (deal) {
        dealStatus = deal.status as unknown as DealStatus;
        for (const p of deal.participants) {
          if (p.walletAddress) knownWallets.push(p.walletAddress);
        }
        if (deal.escrow?.sellerAddress) knownWallets.push(deal.escrow.sellerAddress);
      }
    } catch {
      // default to Negotiating with no known wallets if the deal can't be loaded
    }

    // Pass known wallets so EXTERNAL_WALLET can fire on addresses not in the deal.
    const hits: RuleHit[] = runRules(
      data.message,
      dealStatus,
      knownWallets.length > 0 ? knownWallets : undefined,
    );

    // Persist the transcript chunk to the deal timeline (best-effort).
    void this.persistEvent(data.dealId, data.sender, 'transcript.chunk', {
      text: data.message,
      speakerRole: data.speakerRole ?? 'buyer',
    });

    const currentIntents = Array.from(new Set(hits.map((h) => h.rule.intent)));
    const priorIntents = this.recentIntents.get(data.dealId) ?? [];
    const penalty = repetitionPenalty(currentIntents, priorIntents);

    // Record this message's intents into bounded history for future penalties.
    if (currentIntents.length > 0) {
      const updated = [...priorIntents, ...currentIntents].slice(
        -WebsocketGateway.INTENT_HISTORY_CAP,
      );
      this.recentIntents.set(data.dealId, updated);
    }

    if (hits.length === 0) return;

    const assessment = aggregateFullRisk({
      conversationHits: hits,
      repetitionPenalty: penalty,
    });

    const reasons = hits.map((h) => h.rule.message);
    const payload = {
      dealId: data.dealId,
      score: assessment.score,
      level: assessment.level,
      intents: currentIntents,
      reasons,
      components: assessment.components,
      triggerText: data.message,
      speaker: data.sender,
      timestamp,
    };

    this.server.to(`deal:${data.dealId}`).emit('risk_detected', payload);

    void this.persistEvent(data.dealId, data.sender, 'risk.detected', payload);

    // Notify the deal participants of a high/critical alert.
    if (assessment.level === 'high' || assessment.level === 'critical') {
      void this.notifyParticipants(
        data.dealId,
        `Scam Guard ${assessment.level} alert`,
        reasons[0] ?? 'Suspicious activity detected in the deal room.',
      );
    }
  }

  private async persistEvent(
    dealId: string,
    actorWallet: string,
    type: string,
    metadata: Record<string, unknown>,
  ) {
    try {
      await this.prisma.dealEvent.create({
        data: { dealId, actorWallet: actorWallet || 'system', type, metadata: metadata as object },
      });
    } catch {
      // best-effort
    }
  }

  private async notifyParticipants(dealId: string, title: string, message: string) {
    try {
      const participants = await this.prisma.dealParticipant.findMany({
        where: { dealId },
        select: { walletAddress: true },
      });
      for (const p of participants) {
        const n = await this.notifications.create(
          p.walletAddress,
          title,
          message,
          'AiAlert',
          dealId,
        );
        this.emitNotification(p.walletAddress, {
          id: n.id,
          type: 'AiAlert',
          title,
          message,
          dealId,
          createdAt: n.createdAt,
        });
      }
    } catch {
      // best-effort
    }
  }

  // ── Meeting room subscription ──
  @SubscribeMessage('join_meeting')
  handleJoinMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; wallet?: string },
  ) {
    client.join(`meeting:${data.meetingId}`);
    if (data.wallet) client.join(`user:${data.wallet}`);
    this.logger.log(`Client ${client.id} joined meeting:${data.meetingId}`);
    return { event: 'joined', data: { meetingId: data.meetingId } };
  }

  @SubscribeMessage('leave_meeting')
  handleLeaveMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    client.leave(`meeting:${data.meetingId}`);
    return { event: 'left', data: { meetingId: data.meetingId } };
  }

  // ── Server-side emit helpers (called by services) ──
  emitDealUpdate(dealId: string, payload: Record<string, unknown>) {
    this.server.to(`deal:${dealId}`).emit('deal_update', {
      dealId,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  emitDisputeUpdate(disputeId: string, payload: Record<string, unknown>) {
    this.server.emit('dispute_update', {
      disputeId,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  emitNotification(wallet: string, notification: Record<string, unknown>) {
    this.server.to(`user:${wallet}`).emit('notification', notification);
  }

  emitMeetingTranscript(meetingId: string, transcript: Record<string, unknown>) {
    this.server.to(`meeting:${meetingId}`).emit('meeting_transcript', {
      meetingId,
      transcript,
      timestamp: new Date().toISOString(),
    });
  }

  emitMeetingRiskEvent(meetingId: string, riskEvent: Record<string, unknown>) {
    this.server.to(`meeting:${meetingId}`).emit('meeting_risk_event', {
      meetingId,
      riskEvent,
      timestamp: new Date().toISOString(),
    });
  }
}
