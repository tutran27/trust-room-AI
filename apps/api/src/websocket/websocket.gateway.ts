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
import { analyzeMessage, getLLMClient } from '@trustroom/ai';
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
  // Groq-first LLM client; the Scam Guard degrades to the deterministic layers
  // when no key is configured, so this is always safe to hold.
  private readonly llm = getLLMClient();

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
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChatMessagePayload,
  ) {
    const room = `deal:${data.dealId}`;
    const timestamp = new Date().toISOString();

    // Broadcast to everyone EXCEPT sender (sender already has optimistic update)
    client.broadcast.to(room).emit('chat_message', {
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
    const context = await this.loadDealContext(data.dealId);

    // Full-context analysis: rules + wallet/link parser + (optional) LLM intent
    // classifier + wallet/escrow-state/evidence risk + repetition penalty.
    const analysis = await analyzeMessage(
      {
        message: data.message,
        dealStatus: context.dealStatus,
        dealId: data.dealId,
        speakerId: data.sender,
        speakerRole: data.speakerRole ?? 'buyer',
        timestamp,
        escrowState: context.escrowState,
        knownAddresses: context.knownAddresses,
        priorIntents: context.priorIntents,
        recentMessages: context.recentMessages,
      },
      this.llm,
    );

    // Persist the transcript chunk to the deal timeline (best-effort).
    void this.persistEvent(data.dealId, data.sender, 'transcript.chunk', {
      text: data.message,
      speakerRole: data.speakerRole ?? 'buyer',
    });

    if (analysis.signals.length === 0) return;

    const payload = {
      dealId: data.dealId,
      score: analysis.finalScore,
      level: analysis.finalLevel,
      intents: analysis.intents,
      reasons: analysis.reasons,
      components: {
        conversation: analysis.conversationRisk,
        wallet: analysis.walletRisk,
        escrowState: analysis.escrowStateRisk,
        evidence: analysis.evidenceRisk,
        repetition: analysis.repetitionPenalty,
      },
      signals: analysis.signals,
      suggestedAction: analysis.suggestedAction,
      lockRelease: analysis.lockRelease,
      blockMessage: analysis.blockMessage,
      uiAction: analysis.uiAction,
      triggerText: data.message,
      speaker: data.sender,
      timestamp,
    };

    this.server.to(`deal:${data.dealId}`).emit('risk_detected', payload);

    void this.persistEvent(data.dealId, data.sender, 'risk.detected', payload);

    // Notify the deal participants of a high/critical alert.
    if (analysis.finalLevel === 'high' || analysis.finalLevel === 'critical') {
      void this.notifyParticipants(
        data.dealId,
        `Scam Guard ${analysis.finalLevel} alert`,
        analysis.suggestedAction,
      );
    }
  }

  /**
   * Load the rich deal context the Scam Guard needs: current status, escrow state,
   * the verified wallet set (so a non-deal address in chat reads as "external"),
   * and the intents already flagged earlier in this deal (repetition penalty).
   * Every lookup is best-effort — a DB hiccup degrades gracefully to defaults.
   */
  private async loadDealContext(dealId: string): Promise<{
    dealStatus: DealStatus;
    escrowState?: string;
    knownAddresses: string[];
    priorIntents: ScamIntent[];
    recentMessages: string[];
  }> {
    let dealStatus: DealStatus = 'Negotiating' as DealStatus;
    let escrowState: string | undefined;
    const knownAddresses = new Set<string>();

    try {
      const deal = await this.prisma.deal.findUnique({
        where: { id: dealId },
        select: {
          status: true,
          participants: { select: { walletAddress: true } },
          escrow: { select: { status: true, buyerAddress: true, sellerAddress: true } },
        },
      });
      if (deal) {
        dealStatus = deal.status as unknown as DealStatus;
        escrowState = deal.escrow?.status;
        for (const p of deal.participants) {
          if (p.walletAddress) knownAddresses.add(p.walletAddress);
        }
        if (deal.escrow?.buyerAddress) knownAddresses.add(deal.escrow.buyerAddress);
        if (deal.escrow?.sellerAddress) knownAddresses.add(deal.escrow.sellerAddress);
      }
    } catch {
      // default to Negotiating if the deal can't be loaded
    }

    const { priorIntents, recentMessages } = await this.loadDealHistory(dealId);

    return {
      dealStatus,
      escrowState,
      knownAddresses: Array.from(knownAddresses),
      priorIntents,
      recentMessages,
    };
  }

  /** Pull previously-detected intents (for repetition) and recent message text. */
  private async loadDealHistory(
    dealId: string,
  ): Promise<{ priorIntents: ScamIntent[]; recentMessages: string[] }> {
    const priorIntents: ScamIntent[] = [];
    const recentMessages: string[] = [];
    try {
      const events = await this.prisma.dealEvent.findMany({
        where: { dealId, type: { in: ['risk.detected', 'transcript.chunk'] } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { type: true, metadata: true },
      });
      for (const e of events) {
        const meta = (e.metadata ?? {}) as Record<string, unknown>;
        if (e.type === 'risk.detected' && Array.isArray(meta.intents)) {
          for (const i of meta.intents) {
            if (typeof i === 'string') priorIntents.push(i as ScamIntent);
          }
        }
        if (e.type === 'transcript.chunk' && typeof meta.text === 'string') {
          recentMessages.push(meta.text);
        }
      }
    } catch {
      // best-effort: no history is fine
    }
    return { priorIntents, recentMessages: recentMessages.reverse() };
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
