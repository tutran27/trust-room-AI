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

  // ── User room (notifications) ──
  @SubscribeMessage('join_user')
  handleJoinUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { wallet: string },
  ) {
    if (!data.wallet) {
      return { event: 'join_error', data: { code: 'WALLET_REQUIRED' } };
    }
    client.data.wallet = data.wallet;
    client.join(`user:${data.wallet}`);
    this.logger.log(`Client ${client.id} joined user:${data.wallet}`);
    return { event: 'joined', data: { wallet: data.wallet } };
  }

  // ── Deal room (chat + scam guard) ──
  @SubscribeMessage('join_deal')
  async handleJoinDeal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { dealId: string; wallet?: string },
  ) {
    if (!data.wallet) {
      return { event: 'join_error', data: { code: 'WALLET_REQUIRED' } };
    }

    // Verify wallet is a participant of the deal
    let participant: { role: string } | null = null;
    try {
      participant = await this.prisma.dealParticipant.findUnique({
        where: {
          dealId_walletAddress: {
            dealId: data.dealId,
            walletAddress: data.wallet,
          },
        },
        select: { role: true },
      });
    } catch {
      // Fallback: findMany if unique constraint name differs
      try {
        const results = await this.prisma.dealParticipant.findMany({
          where: { dealId: data.dealId, walletAddress: data.wallet },
          select: { role: true },
          take: 1,
        });
        participant = results[0] ?? null;
      } catch {
        // best-effort
      }
    }

    if (!participant) {
      client.emit('deal_error', {
        dealId: data.dealId,
        code: 'DEAL_FORBIDDEN',
        message: 'You are not a participant of this deal.',
      });
      return { event: 'join_error', data: { code: 'DEAL_FORBIDDEN' } };
    }

    // Store wallet and role on client data for authenticated operations
    client.data.wallet = data.wallet;
    if (!client.data.dealRoles) client.data.dealRoles = {};
    client.data.dealRoles[data.dealId] = participant.role;

    client.join(`deal:${data.dealId}`);
    client.join(`user:${data.wallet}`);
    this.logger.log(
      `Client ${client.id} joined deal:${data.dealId} as ${participant.role}`,
    );
    return {
      event: 'joined',
      data: { dealId: data.dealId, role: participant.role },
    };
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
   * A chat / transcript message in a deal room. Runs the message through the
   * Scam Guard FIRST, then conditionally broadcasts. Never trusts `sender` or
   * `speakerRole` from the client — uses `client.data` populated at join time.
   *
   * Flow:
   * 1. Verify the sender is authenticated (has wallet in client.data)
   * 2. Verify the sender is a participant of the deal
   * 3. Run Scam Guard analysis
   * 4. If blockMessage → emit message_blocked + risk_detected (no raw broadcast)
   * 5. Otherwise → broadcast to room, persist transcript
   */
  @SubscribeMessage('chat_message')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChatMessagePayload,
  ) {
    const room = `deal:${data.dealId}`;
    const timestamp = new Date().toISOString();

    // 1. Use authenticated wallet from client.data, NOT from payload
    const wallet = client.data.wallet as string | undefined;
    if (!wallet) {
      return {
        event: 'join_error',
        data: { code: 'NOT_AUTHENTICATED', message: 'Join a deal room first with a valid wallet.' },
      };
    }

    // 2. Verify participant from stored role
    const role = client.data.dealRoles?.[data.dealId] as string | undefined;
    if (!role) {
      client.emit('deal_error', {
        dealId: data.dealId,
        code: 'DEAL_FORBIDDEN',
        message: 'You must join this deal room first.',
      });
      return { event: 'join_error', data: { code: 'DEAL_FORBIDDEN' } };
    }

    // Build trusted sender info
    const trustedSender = wallet;
    const trustedRole = role as 'buyer' | 'seller' | 'ai' | 'system';

    // 3. Run Scam Guard BEFORE broadcast — get back analysis or undefined
    const analysis = await this.runScamGuard(
      {
        dealId: data.dealId,
        message: data.message,
        sender: trustedSender,
        speakerRole: trustedRole,
      },
      timestamp,
    );

    // 4. If blockMessage → do NOT broadcast raw message
    if (analysis?.blockMessage) {
      client.emit('message_blocked', {
        dealId: data.dealId,
        reason: analysis.suggestedAction ?? 'Message blocked by Scam Guard.',
        intents: analysis.intents,
        level: analysis.level,
      });

      // Persist the blocked event (best-effort)
      void this.persistEvent(data.dealId, trustedSender, 'message.blocked', {
        text: data.message,
        speakerRole: trustedRole,
        intents: analysis.intents,
        level: analysis.level,
      });

      return { event: 'message_blocked' };
    }

    // 5. Broadcast to room
    this.server.to(room).emit('chat_message', {
      dealId: data.dealId,
      message: data.message,
      sender: trustedSender,
      speakerRole: trustedRole,
      timestamp,
    });

    return { event: 'message_sent' };
  }

  /**
   * Run Scam Guard analysis and broadcast risk events. Returns the analysis
   * result (or undefined if no signals fired) so the caller can check
   * blockMessage before broadcasting the raw message.
   */
  private async runScamGuard(
    data: ChatMessagePayload,
    timestamp: string,
  ): Promise<{
    blockMessage: boolean;
    suggestedAction?: string;
    intents: string[];
    level: string;
    lockRelease: boolean;
    signals: unknown[];
    finalScore: number;
    [key: string]: unknown;
  } | undefined> {
    const context = await this.loadDealContext(data.dealId);

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

    // Persist the transcript chunk (best-effort).
    void this.persistEvent(data.dealId, data.sender, 'transcript.chunk', {
      text: data.message,
      speakerRole: data.speakerRole ?? 'buyer',
    });

    if (analysis.signals.length === 0) return undefined;

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

    // Notify participants of high/critical alert.
    if (analysis.finalLevel === 'high' || analysis.finalLevel === 'critical') {
      void this.notifyParticipants(
        data.dealId,
        `Scam Guard ${analysis.finalLevel} alert`,
        analysis.suggestedAction,
      );
    }

    return {
      blockMessage: analysis.blockMessage,
      suggestedAction: analysis.suggestedAction,
      intents: analysis.intents,
      level: analysis.finalLevel,
      lockRelease: analysis.lockRelease,
      signals: analysis.signals,
      finalScore: analysis.finalScore,
    };
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
          escrow: { select: { status: true } },
        },
      });
      if (deal) {
        dealStatus = deal.status as unknown as DealStatus;
        escrowState = deal.escrow?.status;
        for (const p of deal.participants) {
          if (p.walletAddress) knownAddresses.add(p.walletAddress);
        }
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
    if (data.wallet) {
      client.data.wallet = data.wallet;
      client.join(`user:${data.wallet}`);
    }
    this.logger.log(`Client ${client.id} joined meeting:${data.meetingId}`);

    // Notify other participants that a user joined
    const wallet = data.wallet ?? client.data.wallet;
    if (wallet) {
      client.to(`meeting:${data.meetingId}`).emit('user_joined', {
        meetingId: data.meetingId,
        wallet,
        timestamp: new Date().toISOString(),
      });
    }

    return { event: 'joined', data: { meetingId: data.meetingId } };
  }

  @SubscribeMessage('leave_meeting')
  handleLeaveMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    const wallet = client.data.wallet as string | undefined;
    client.leave(`meeting:${data.meetingId}`);

    // Notify other participants that a user left
    if (wallet) {
      client.to(`meeting:${data.meetingId}`).emit('user_left', {
        meetingId: data.meetingId,
        wallet,
        timestamp: new Date().toISOString(),
      });
    }

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

  /**
   * Emit TTS audio frame to a meeting room.
   * Each frame is a base64-encoded PCM int16 chunk at 24kHz mono.
   */
  emitMeetingTtsAudio(meetingId: string, frame: Record<string, unknown>) {
    this.server.to(`meeting:${meetingId}`).emit('meeting_tts_audio', {
      meetingId,
      frame,
      timestamp: new Date().toISOString(),
    });
  }

  /** Emit TTS sentence marker (for UI subtitles) */
  emitMeetingTtsSentence(meetingId: string, sentence: Record<string, unknown>) {
    this.server.to(`meeting:${meetingId}`).emit('meeting_tts_sentence', {
      meetingId,
      sentence,
      timestamp: new Date().toISOString(),
    });
  }

  /** Emit TTS done signal */
  emitMeetingTtsDone(meetingId: string, done: Record<string, unknown>) {
    this.server.to(`meeting:${meetingId}`).emit('meeting_tts_done', {
      meetingId,
      done,
      timestamp: new Date().toISOString(),
    });
  }

  emitMeetingTranslationEvent(meetingId: string, event: string, payload: Record<string, unknown>) {
    this.server.to(`meeting:${meetingId}`).emit(event, {
      meetingId,
      ...payload,
    });
  }

  emitMeetingTranslationAudio(meetingId: string, payload: Record<string, unknown>) {
    this.server.to(`meeting:${meetingId}`).emit('translated_audio_ready', {
      meetingId,
      ...payload,
    });
  }
}
