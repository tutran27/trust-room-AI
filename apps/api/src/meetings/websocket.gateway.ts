import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TranslationService } from '../translation/translation.service';

@WebSocketGateway({
  cors: {
    origin: process.env.WS_CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class MeetingsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MeetingsGateway.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly translationService: TranslationService,
  ) {}

  // ── Connection lifecycle ──

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // ── Meeting join / leave ──

  @SubscribeMessage('meeting:join')
  async handleJoinMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; userAddress: string; displayName?: string },
  ) {
    const { meetingId, userAddress } = data;
    const room = `meeting:${meetingId}`;

    await client.join(room);

    // Persist participant in DB
    try {
      // Resolve sessionId from meetingId
      const session = await this.prisma.meetingSession.findFirst({
        where: { id: meetingId },
      });
      if (session) {
        await this.prisma.meetingParticipant.upsert({
          where: {
            sessionId_walletAddress: { sessionId: session.id, walletAddress: userAddress },
          },
          update: { leftAt: null, isActive: true },
          create: {
            sessionId: session.id,
            walletAddress: userAddress,
            role: 'guest',
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to persist participant: ${err}`);
    }

    // Notify others
    client.to(room).emit('user_joined', {
      userAddress,
      displayName: userAddress.slice(0, 8),
      timestamp: Date.now(),
    });

    // Send room state to joiner
    try {
      const session = await this.prisma.meetingSession.findFirst({
        where: { id: meetingId },
        include: { participants: true },
      });

      if (session) {
        return {
          event: 'meeting:state',
          data: {
            participants: session.participants.map((p) => ({
              userAddress: p.walletAddress,
              displayName: p.walletAddress.slice(0, 8),
              joinedAt: p.joinedAt,
              role: p.role,
              isActive: p.isActive,
            })),
          },
        };
      }
    } catch (err) {
      this.logger.warn(`Failed to fetch participants: ${err}`);
    }

    return {
      event: 'meeting:state',
      data: { participants: [] },
    };
  }

  @SubscribeMessage('meeting:leave')
  async handleLeaveMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; userAddress: string },
  ) {
    const { meetingId, userAddress } = data;
    const room = `meeting:${meetingId}`;

    // Mark disconnected in DB
    try {
      await this.prisma.meetingParticipant.updateMany({
        where: { sessionId: meetingId, walletAddress: userAddress, isActive: true },
        data: { isActive: false, leftAt: new Date() },
      });
    } catch (err) {
      this.logger.warn(`Failed to mark participant leave: ${err}`);
    }

    client.to(room).emit('user_left', {
      userAddress,
      timestamp: Date.now(),
    });

    await client.leave(room);
    return { event: 'meeting:left', data: { meetingId } };
  }

  // ── STT / Transcription events ──

  @SubscribeMessage('transcript:partial')
  handleTranscriptPartial(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      meetingId: string;
      speakerWallet: string;
      text: string;
      timestamp: number;
    },
  ) {
    const room = `meeting:${data.meetingId}`;
    client.to(room).emit('transcript:partial', data);
    return { event: 'transcript:partial:ack', data: { ok: true } };
  }

  @SubscribeMessage('transcript:final')
  handleTranscriptFinal(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      meetingId: string;
      speakerWallet: string;
      text: string;
      timestamp: number;
      durationMs?: number;
    },
  ) {
    const room = `meeting:${data.meetingId}`;
    this.server.to(room).emit('transcript:final', data);

    // Persist final transcript
    this.prisma.meetingTranscript
      .create({
        data: {
          sessionId: data.meetingId,
          speakerLabel: data.speakerWallet,
          content: data.text,
          startTime: data.timestamp,
          endTime: data.durationMs ? data.timestamp + data.durationMs : null,
          language: 'vi',
        },
      })
      .catch((err: unknown) => this.logger.warn(`Failed to persist transcript: ${err}`));

    return { event: 'transcript:final:ack', data: { ok: true } };
  }

  // ── Translation events ──

  @SubscribeMessage('translation:start')
  async handleTranslationStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      meetingId: string;
      transcriptId: string;
      sourceLang: string;
      targetLang: string;
      text: string;
    },
  ) {
    const room = `meeting:${data.meetingId}`;

    // Persist translation job
    try {
      await this.prisma.meetingTranslationJob.create({
        data: {
          sessionId: data.meetingId,
          transcriptId: data.transcriptId,
          sourceLang: data.sourceLang,
          targetLang: data.targetLang,
          sourceText: data.text,
          status: 'processing',
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to persist translation job: ${err}`);
    }

    // Notify room that translation started
    this.server.to(room).emit('translation:started', {
      meetingId: data.meetingId,
      transcriptId: data.transcriptId,
      sourceLang: data.sourceLang,
      targetLang: data.targetLang,
      timestamp: Date.now(),
    });

    return { event: 'translation:start:ack', data: { ok: true } };
  }

  @SubscribeMessage('translation:cancel')
  async handleTranslationCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; transcriptId: string },
  ) {
    const room = `meeting:${data.meetingId}`;

    try {
      await this.prisma.meetingTranslationJob.updateMany({
        where: {
          sessionId: data.meetingId,
          transcriptId: data.transcriptId,
          status: 'processing',
        },
        data: { status: 'cancelled' },
      });
    } catch (err) {
      this.logger.warn(`Failed to cancel translation: ${err}`);
    }

    this.server.to(room).emit('translation:cancelled', {
      meetingId: data.meetingId,
      transcriptId: data.transcriptId,
      timestamp: Date.now(),
    });

    return { event: 'translation:cancel:ack', data: { ok: true } };
  }

  // ── Voice activity ──

  @SubscribeMessage('voice:activity')
  handleVoiceActivity(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      meetingId: string;
      userAddress: string;
      isActive: boolean;
    },
  ) {
    const room = `meeting:${data.meetingId}`;
    client.to(room).emit('voice:activity', data);
    return { event: 'voice:activity:ack', data: { ok: true } };
  }

  // ── Signaling (WebRTC/Agora relay) ──

  @SubscribeMessage('signal:relay')
  handleSignalRelay(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      meetingId: string;
      targetUser: string;
      signalType: string;
      payload: any;
    },
  ) {
    const room = `meeting:${data.meetingId}`;
    client.to(room).emit('signal:relay', {
      fromUser: client.data?.userAddress ?? 'unknown',
      signalType: data.signalType,
      payload: data.payload,
    });
    return { event: 'signal:relay:ack', data: { ok: true } };
  }

  // ── Screen sharing ──

  @SubscribeMessage('screen:share')
  handleScreenShare(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      meetingId: string;
      userAddress: string;
      isSharing: boolean;
    },
  ) {
    const room = `meeting:${data.meetingId}`;
    client.to(room).emit('screen:share', data);
    return { event: 'screen:share:ack', data: { ok: true } };
  }

  // ── Public emit helpers ──

  emitTranscriptFinal(meetingId: string, data: any) {
    this.server.to(`meeting:${meetingId}`).emit('transcript:final', data);
  }

  emitTranslationJobCreated(meetingId: string, data: any) {
    this.server.to(`meeting:${meetingId}`).emit('translation:job_created', data);
  }

  emitTranslatedTranscript(meetingId: string, data: any) {
    this.server.to(`meeting:${meetingId}`).emit('translated_transcript', data);
  }

  emitTranslatedAudioReady(meetingId: string, data: any) {
    this.server.to(`meeting:${meetingId}`).emit('translated_audio_ready', data);
  }

  emitTranslationError(meetingId: string, data: any) {
    this.server.to(`meeting:${meetingId}`).emit('translation_error', data);
  }

  emitMessage(meetingId: string, data: any) {
    this.server.to(`meeting:${meetingId}`).emit('chat:message', data);
  }
}