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
import { Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { analyzeTranscript } from '@trustroom/ai';
import { type DealStatus } from '@trustroom/types';
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

  constructor(
    private readonly prisma: PrismaService,
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
    try {
      const deal = await this.prisma.deal.findUnique({
        where: { id: data.dealId },
        select: { status: true },
      });
      if (deal) dealStatus = deal.status as unknown as DealStatus;
    } catch {
      // default to Negotiating if the deal can't be loaded
    }

    const analysis = analyzeTranscript(data.message, dealStatus);

    // Persist the transcript chunk to the deal timeline (best-effort).
    void this.persistEvent(data.dealId, data.sender, 'transcript.chunk', {
      text: data.message,
      speakerRole: data.speakerRole ?? 'buyer',
    });

    if (analysis.hits.length === 0) return;

    const reasons = analysis.hits.map((h) => h.rule.message);
    const payload = {
      dealId: data.dealId,
      score: analysis.score,
      level: analysis.level,
      intents: analysis.intents,
      reasons,
      triggerText: data.message,
      speaker: data.sender,
      timestamp,
    };

    this.server.to(`deal:${data.dealId}`).emit('risk_detected', payload);

    void this.persistEvent(data.dealId, data.sender, 'risk.detected', payload);

    // Notify the deal participants of a high/critical alert.
    if (analysis.level === 'high' || analysis.level === 'critical') {
      void this.notifyParticipants(
        data.dealId,
        `Scam Guard ${analysis.level} alert`,
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
}
