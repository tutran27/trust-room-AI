import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { analyzeTranscript } from '@trustroom/ai';
import { Prisma } from '@trustroom/db';
import { DealStatus, type DealStatus as CanonicalDealStatus } from '@trustroom/types';
import { RtcRole, RtcTokenBuilder } from 'agora-token';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { StartMeetingSttDto } from './dto/stt.dto';

interface AgoraSttAgentSummary {
  agent_id: string;
  status: string;
  start_ts?: number;
}

interface AgoraSttJoinResponse {
  agent_id?: string;
  status?: string;
  data?: {
    agent_id?: string;
    status?: string;
  };
}

interface AgoraSttListResponse {
  agents?: AgoraSttAgentSummary[];
  data?: AgoraSttAgentSummary[] | { list?: AgoraSttAgentSummary[] };
}

interface AgoraSttErrorPayload {
  detail?: string;
  error?: string;
  message?: string;
  reason?: string;
}

export interface MeetingSttState {
  enabled: boolean;
  mode: 'demo_manual' | 'asr_only' | 'asr_translate';
  status:
    | 'idle'
    | 'starting'
    | 'running'
    | 'fallback_asr_only'
    | 'stopping'
    | 'error';
  agentId: string | null;
  pusherUid: number | null;
  languages: string[];
  targetLanguages: string[];
  fallbackReason: string | null;
}

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateMeetingDto, walletAddress: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dto.dealId },
      include: { participants: true },
    });
    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    const participant = deal.participants.find(
      (item) => item.walletAddress === walletAddress,
    );
    if (!participant) {
      throw new ForbiddenException('Not a deal participant');
    }

    const session = await this.prisma.meetingSession.create({
      data: {
        dealId: dto.dealId,
        title: dto.title,
        status: dto.scheduledAt ? 'Scheduled' : 'Active',
        startedAt: dto.scheduledAt ? null : new Date(),
      },
    });

    await this.prisma.meetingParticipant.create({
      data: {
        sessionId: session.id,
        walletAddress,
        role: participant.role === 'buyer' ? 'buyer' : 'seller',
        isActive: true,
      },
    });

    return this.findById(session.id);
  }

  async findByDeal(dealId: string) {
    return this.prisma.meetingSession.findMany({
      where: { dealId },
      include: {
        participants: true,
        invites: true,
        _count: { select: { transcripts: true, invites: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const session = await this.prisma.meetingSession.findUnique({
      where: { id },
      include: {
        participants: true,
        invites: true,
        transcripts: {
          include: { translations: true, riskEvents: true },
          orderBy: { startTime: 'asc' },
        },
        riskEvents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!session) {
      throw new NotFoundException('Meeting session not found');
    }

    return session;
  }

  async updateStatus(
    id: string,
    status: 'Scheduled' | 'Active' | 'Ended',
    walletAddress: string,
  ) {
    const session = await this.prisma.meetingSession.findUnique({
      where: { id },
      include: { participants: true },
    });
    if (!session) {
      throw new NotFoundException('Meeting session not found');
    }

    const participant = session.participants.find(
      (item) => item.walletAddress === walletAddress && item.isActive,
    );
    if (!participant) {
      throw new ForbiddenException('Only active participants can update the meeting status.');
    }

    return this.prisma.meetingSession.update({
      where: { id },
      data: {
        status,
        startedAt: status === 'Active' && !session.startedAt ? new Date() : undefined,
        endedAt: status === 'Ended' ? new Date() : undefined,
      },
    });
  }

  async createInvite(
    sessionId: string,
    inviterWalletAddress: string,
    invitedWalletAddress: string | null,
    role: 'buyer' | 'seller' | 'arbiter' | 'guest',
    maxUses: number,
    expiresAt: Date,
  ) {
    const session = await this.prisma.meetingSession.findUnique({
      where: { id: sessionId },
      include: { participants: true },
    });
    if (!session) {
      throw new NotFoundException('Meeting session not found');
    }

    const isHost = session.participants.some(
      (item) => item.walletAddress === inviterWalletAddress && item.isActive,
    );
    if (!isHost) {
      throw new ForbiddenException('Only active participants can create invites.');
    }
    if (session.status === 'Ended') {
      throw new BadRequestException('Cannot invite participants to an ended meeting.');
    }

    return this.prisma.meetingInvite.create({
      data: {
        sessionId,
        walletAddress: invitedWalletAddress,
        role,
        token: crypto.randomBytes(24).toString('hex'),
        maxUses,
        expiresAt,
      },
    });
  }

  async joinByToken(token: string, walletAddress: string) {
    const invite = await this.prisma.meetingInvite.findUnique({
      where: { token },
      include: { session: true },
    });

    if (!invite) {
      throw new NotFoundException('Invalid invite token');
    }
    if (invite.status !== 'Pending') {
      throw new BadRequestException('Invite is no longer active.');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite expired.');
    }
    if (invite.usedCount >= invite.maxUses) {
      throw new BadRequestException('Invite max uses reached.');
    }
    if (invite.walletAddress && invite.walletAddress !== walletAddress) {
      throw new ForbiddenException('Invite is restricted to a different wallet.');
    }
    if (invite.session.status === 'Ended') {
      throw new BadRequestException('Meeting already ended.');
    }

    await this.addParticipant(invite.sessionId, walletAddress, invite.role);

    await this.prisma.meetingInvite.update({
      where: { id: invite.id },
      data: {
        usedCount: { increment: 1 },
        status: invite.usedCount + 1 >= invite.maxUses ? 'Accepted' : undefined,
      },
    });

    return invite;
  }

  async removeParticipant(sessionId: string, walletAddress: string) {
    const participant = await this.prisma.meetingParticipant.findUnique({
      where: { sessionId_walletAddress: { sessionId, walletAddress } },
    });
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    return this.prisma.meetingParticipant.update({
      where: { id: participant.id },
      data: { isActive: false, leftAt: new Date() },
    });
  }

  async addParticipant(
    sessionId: string,
    walletAddress: string,
    role: 'buyer' | 'seller' | 'arbiter' | 'guest',
  ) {
    const session = await this.ensureMeetingExists(sessionId);
    if (session.status === 'Ended') {
      throw new BadRequestException('Cannot join an ended meeting.');
    }

    return this.prisma.meetingParticipant.upsert({
      where: { sessionId_walletAddress: { sessionId, walletAddress } },
      update: { isActive: true, leftAt: null },
      create: { sessionId, walletAddress, role, isActive: true },
    });
  }

  async addTranscript(data: {
    sessionId: string;
    participantId?: string;
    speakerLabel: string;
    content: string;
    confidence?: number;
    startTime: number;
    endTime?: number;
    language?: string;
  }) {
    const session = await this.prisma.meetingSession.findUnique({
      where: { id: data.sessionId },
      include: {
        deal: { select: { status: true } },
        participants: { select: { id: true } },
      },
    });
    if (!session) {
      throw new NotFoundException('Meeting session not found');
    }

    if (
      data.participantId &&
      !session.participants.some((participant) => participant.id === data.participantId)
    ) {
      throw new BadRequestException('participantId does not belong to this meeting session.');
    }

    const transcript = await this.prisma.meetingTranscript.create({
      data: {
        sessionId: data.sessionId,
        participantId: data.participantId,
        speakerLabel: data.speakerLabel,
        content: data.content,
        confidence: data.confidence,
        startTime: data.startTime,
        endTime: data.endTime,
        language: data.language ?? 'vi',
      },
      include: {
        translations: true,
        riskEvents: true,
      },
    });

    const normalizedStatus = this.toCanonicalDealStatus(session.deal.status);
    const analysis = analyzeTranscript(data.content, normalizedStatus);

    if (analysis.hits.length > 0) {
      await Promise.all(
        analysis.hits.map((hit) =>
          this.prisma.meetingRiskEvent.create({
            data: {
              sessionId: data.sessionId,
              transcriptId: transcript.id,
              type: hit.rule.intent,
              severity: hit.rule.riskLevel,
              description: hit.rule.message,
              evidence: {
                ruleId: hit.rule.ruleId,
                matchedKeyword: hit.matchedKeyword,
                score: analysis.score,
                level: analysis.level,
              } as Prisma.InputJsonValue,
            },
          }),
        ),
      );
    }

    return this.prisma.meetingTranscript.findUnique({
      where: { id: transcript.id },
      include: {
        translations: true,
        riskEvents: true,
      },
    });
  }

  async getTranscripts(sessionId: string) {
    return this.prisma.meetingTranscript.findMany({
      where: { sessionId },
      include: { translations: true, riskEvents: true },
      orderBy: { startTime: 'asc' },
    });
  }

  async addTranslation(data: {
    transcriptId: string;
    sessionId: string;
    targetLanguage: string;
    content: string;
    provider?: string;
  }) {
    const transcript = await this.prisma.meetingTranscript.findUnique({
      where: { id: data.transcriptId },
      select: { id: true, sessionId: true },
    });
    if (!transcript || transcript.sessionId !== data.sessionId) {
      throw new NotFoundException('Transcript not found');
    }

    const cacheKey = `${data.transcriptId}:${data.targetLanguage}`;
    return this.prisma.meetingTranslation.upsert({
      where: { cacheKey },
      update: {
        content: data.content,
        provider: data.provider ?? 'agora-stt',
      },
      create: {
        transcriptId: data.transcriptId,
        sessionId: data.sessionId,
        targetLanguage: data.targetLanguage,
        content: data.content,
        cacheKey,
        provider: data.provider ?? 'agora-stt',
      },
    });
  }

  async addRiskEvent(data: {
    sessionId: string;
    transcriptId?: string;
    type: string;
    severity?: string;
    description: string;
    evidence?: Prisma.InputJsonValue;
  }) {
    return this.prisma.meetingRiskEvent.create({
      data: {
        sessionId: data.sessionId,
        transcriptId: data.transcriptId,
        type: data.type,
        severity: data.severity ?? 'medium',
        description: data.description,
        evidence: data.evidence ?? Prisma.DbNull,
      },
    });
  }

  async getRiskEvents(sessionId: string) {
    return this.prisma.meetingRiskEvent.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  generateAgoraToken(
    channelName: string,
    uid: number,
    role: number,
    expirationInSeconds: number,
  ) {
    const appId = this.configService.get<string>('AGORA_APP_ID') ?? process.env.AGORA_APP_ID;
    const appCertificate =
      this.configService.get<string>('AGORA_APP_CERTIFICATE') ??
      process.env.AGORA_APP_CERTIFICATE;
    if (!appId || !appCertificate) {
      throw new BadRequestException(
        'Agora credentials are missing on the API server (AGORA_APP_ID / AGORA_APP_CERTIFICATE).',
      );
    }

    try {
      const normalizedUid = Number(uid);
      const normalizedRole = Number(role);
      const normalizedExpiry = Number(expirationInSeconds);

      if (
        !Number.isInteger(normalizedUid) ||
        normalizedUid <= 0 ||
        !Number.isInteger(normalizedRole) ||
        !Number.isInteger(normalizedExpiry) ||
        normalizedExpiry <= 0
      ) {
        throw new BadRequestException('Agora token inputs must be positive integers.');
      }

      const tokenExpire = Math.floor(Date.now() / 1000) + normalizedExpiry;
      const rtcRole = normalizedRole === 2 ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

      return RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        normalizedUid,
        rtcRole,
        tokenExpire,
        tokenExpire,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        'Failed to generate Agora token',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to generate Agora token.');
    }
  }

  getAgoraTokenPayload(
    sessionId: string,
    uid: number,
    role: number,
    expirationInSeconds: number,
  ) {
    const expiresAt = Math.floor(Date.now() / 1000) + expirationInSeconds;
    return {
      token: this.generateAgoraToken(sessionId, uid, role, expirationInSeconds),
      channel: sessionId,
      uid,
      expiresAt,
    };
  }

  async getSttState(sessionId: string): Promise<MeetingSttState> {
    await this.ensureMeetingExists(sessionId);

    if (!this.hasSttCredentials()) {
      return this.buildDemoSttState(this.buildMissingCredentialMessage());
    }

    let runningAgent: AgoraSttAgentSummary | null;
    try {
      runningAgent = await this.findRunningSttAgent(sessionId);
    } catch (error) {
      if (this.isAgoraSttUnavailableError(error)) {
        return this.buildDemoSttState(
          'Project Agora hiện chưa bật dịch vụ Speech-to-Text, nên meeting đang ở chế độ demo/manual transcript.',
        );
      }
      throw error;
    }

    if (!runningAgent) {
      return {
        enabled: false,
        mode: 'asr_only',
        status: 'idle',
        agentId: null,
        pusherUid: null,
        languages: [],
        targetLanguages: [],
        fallbackReason: null,
      };
    }

    return {
      enabled: true,
      mode: 'asr_only',
      status: 'running',
      agentId: runningAgent.agent_id,
      pusherUid: this.getSttPusherUid(sessionId),
      languages: [],
      targetLanguages: [],
      fallbackReason: null,
    };
  }

  async startSttAgent(
    sessionId: string,
    walletAddress: string,
    dto: StartMeetingSttDto,
  ): Promise<MeetingSttState> {
    await this.ensureActiveParticipant(sessionId, walletAddress);

    if (!this.hasSttCredentials()) {
      return this.buildDemoSttState(this.buildMissingCredentialMessage());
    }

    let runningAgent: AgoraSttAgentSummary | null;
    try {
      runningAgent = await this.findRunningSttAgent(sessionId);
    } catch (error) {
      if (this.isAgoraSttUnavailableError(error)) {
        return this.buildDemoSttState(
          'Project Agora hiện chưa bật dịch vụ Speech-to-Text, nên hệ thống đang dùng transcript thủ công/demo.',
        );
      }
      throw error;
    }

    if (runningAgent) {
      return {
        enabled: true,
        mode:
          dto.enableTranslation && (dto.targetLanguages?.length ?? 0) > 0
            ? 'asr_translate'
            : 'asr_only',
        status: 'running',
        agentId: runningAgent.agent_id,
        pusherUid: this.getSttPusherUid(sessionId),
        languages: dto.languages ?? [],
        targetLanguages: dto.enableTranslation ? dto.targetLanguages ?? [] : [],
        fallbackReason: null,
      };
    }

    const languages = dto.languages?.length ? dto.languages : ['vi-VN', 'en-US'];
    const targetLanguages = dto.targetLanguages?.filter(Boolean) ?? [];
    const pusherUid = this.getSttPusherUid(sessionId);
    const botToken = this.generateAgoraToken(sessionId, pusherUid, 1, 3600);
    const basePayload = {
      name: this.buildSttAgentName(sessionId),
      languages,
      maxIdleTime: dto.maxIdleTime ?? 300,
      rtcConfig: {
        channelName: sessionId,
        pubBotUid: String(pusherUid),
        pubBotToken: botToken,
        subscribeAudioUids:
          dto.subscribeAudioUids?.length && !dto.subscribeAudioUids.includes('all')
            ? dto.subscribeAudioUids
            : undefined,
        enableJsonProtocol: true,
      },
    };

    if (dto.enableTranslation && targetLanguages.length > 0 && languages.length === 1) {
      try {
        const translated = await this.callAgoraSttJoin({
          ...basePayload,
          translateConfig: {
            languages: [
              {
                source: languages[0],
                target: targetLanguages,
              },
            ],
          },
        });

        return {
          enabled: true,
          mode: 'asr_translate',
          status: 'running',
          agentId: translated.agent_id,
          pusherUid,
          languages,
          targetLanguages,
          fallbackReason: null,
        };
      } catch (error) {
        if (this.isAgoraSttUnavailableError(error)) {
          return this.buildDemoSttState(
            'Project Agora hiện chưa bật dịch vụ Speech-to-Text, nên hệ thống đang dùng transcript thủ công/demo.',
          );
        }
        this.logger.warn(
          `Agora translation start failed for meeting ${sessionId}; retrying ASR-only. ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    try {
      const asrOnly = await this.callAgoraSttJoin(basePayload);
      return {
        enabled: true,
        mode: 'asr_only',
        status:
          dto.enableTranslation && targetLanguages.length > 0 ? 'fallback_asr_only' : 'running',
        agentId: asrOnly.agent_id,
        pusherUid,
        languages,
        targetLanguages: [],
        fallbackReason:
          dto.enableTranslation && targetLanguages.length > 0
            ? 'Agora translation unavailable. Meeting is running with ASR-only transcript.'
            : null,
      };
    } catch (error) {
      if (this.isAgoraSttUnavailableError(error)) {
        return this.buildDemoSttState(
          'Project Agora hiện chưa bật dịch vụ Speech-to-Text, nên hệ thống đang dùng transcript thủ công/demo.',
        );
      }
      this.logger.error(
        'Failed to start Agora STT agent',
        error instanceof Error ? error.stack : String(error),
      );
      throw error instanceof HttpException
        ? error
        : new InternalServerErrorException('Failed to start Agora STT agent.');
    }
  }

  async stopSttAgent(sessionId: string, walletAddress: string): Promise<MeetingSttState> {
    await this.ensureActiveParticipant(sessionId, walletAddress);

    if (!this.hasSttCredentials()) {
      return this.buildDemoSttState();
    }

    let runningAgent: AgoraSttAgentSummary | null;
    try {
      runningAgent = await this.findRunningSttAgent(sessionId);
    } catch (error) {
      if (this.isAgoraSttUnavailableError(error)) {
        return this.buildDemoSttState('Project Agora hiện chưa bật dịch vụ Speech-to-Text.');
      }
      throw error;
    }

    if (!runningAgent) {
      return {
        enabled: false,
        mode: 'asr_only',
        status: 'idle',
        agentId: null,
        pusherUid: null,
        languages: [],
        targetLanguages: [],
        fallbackReason: null,
      };
    }

    await this.callAgoraSttLeave(runningAgent.agent_id);
    return {
      enabled: false,
      mode: 'asr_only',
      status: 'idle',
      agentId: null,
      pusherUid: null,
      languages: [],
      targetLanguages: [],
      fallbackReason: null,
    };
  }

  private buildDemoSttState(fallbackReason: string | null = null): MeetingSttState {
    return {
      enabled: false,
      mode: 'demo_manual',
      status: 'idle',
      agentId: null,
      pusherUid: null,
      languages: [],
      targetLanguages: [],
      fallbackReason,
    };
  }

  private async ensureMeetingExists(sessionId: string) {
    const meeting = await this.prisma.meetingSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    });
    if (!meeting) {
      throw new NotFoundException('Meeting session not found');
    }
    return meeting;
  }

  private async ensureActiveParticipant(sessionId: string, walletAddress: string) {
    const session = await this.prisma.meetingSession.findUnique({
      where: { id: sessionId },
      include: { participants: true },
    });
    if (!session) {
      throw new NotFoundException('Meeting session not found');
    }
    if (session.status === 'Ended') {
      throw new BadRequestException('Meeting already ended.');
    }

    const participant = session.participants.find(
      (item) => item.walletAddress === walletAddress && item.isActive,
    );
    if (!participant) {
      throw new ForbiddenException('Only active meeting participants can control STT.');
    }

    return participant;
  }

  private hasSttCredentials() {
    return this.getMissingSttCredentialNames().length === 0;
  }

  private buildMissingCredentialMessage() {
    const missing = this.getMissingSttCredentialNames();
    return `Thiếu cấu hình Agora STT trên API server (${missing.join(', ')}), nên meeting đang ở chế độ demo/manual transcript.`;
  }

  private getMissingSttCredentialNames() {
    const required = [
      'AGORA_APP_ID',
      'AGORA_APP_CERTIFICATE',
      'AGORA_CUSTOMER_ID',
      'AGORA_CUSTOMER_SECRET',
    ] as const;

    return required.filter((key) => {
      const value = this.configService.get<string>(key) ?? process.env[key];
      return !value || !String(value).trim();
    });
  }

  private getAgoraSttAuthHeader() {
    const customerId =
      this.configService.get<string>('AGORA_CUSTOMER_ID') ?? process.env.AGORA_CUSTOMER_ID;
    const customerSecret =
      this.configService.get<string>('AGORA_CUSTOMER_SECRET') ??
      process.env.AGORA_CUSTOMER_SECRET;
    if (!customerId || !customerSecret) {
      throw new BadRequestException(
        'Agora STT credentials are missing on the API server (AGORA_CUSTOMER_ID / AGORA_CUSTOMER_SECRET).',
      );
    }

    return `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString('base64')}`;
  }

  private async callAgoraSttApi<T>(path: string, init?: RequestInit): Promise<T> {
    const appId = this.configService.get<string>('AGORA_APP_ID') ?? process.env.AGORA_APP_ID;
    if (!appId) {
      throw new BadRequestException('AGORA_APP_ID is missing.');
    }

    const response = await fetch(
      `https://api.agora.io/api/speech-to-text/v1/projects/${appId}${path}`,
      {
        ...init,
        headers: {
          Authorization: this.getAgoraSttAuthHeader(),
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
      },
    );

    const rawText = await response.text();
    const payload = rawText ? this.parseAgoraPayload(rawText) : {};

    if (!response.ok) {
      throw new BadRequestException(this.extractAgoraErrorMessage(payload, response.status));
    }

    return payload as T;
  }

  private async callAgoraSttJoin(payload: Record<string, unknown>) {
    const response = await this.callAgoraSttApi<AgoraSttJoinResponse>(`/join`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const agentId = response.agent_id ?? response.data?.agent_id ?? null;
    const status = response.status ?? response.data?.status ?? 'running';
    if (!agentId) {
      throw new InternalServerErrorException(
        'Agora STT join response did not include an agent id.',
      );
    }

    return {
      agent_id: agentId,
      status,
    };
  }

  private async callAgoraSttLeave(agentId: string) {
    return this.callAgoraSttApi<{ status: string }>(`/agents/${agentId}/leave`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  private async callAgoraSttList(channelName: string) {
    const query = new URLSearchParams({
      channel: channelName,
      limit: '20',
    });

    const payload = await this.callAgoraSttApi<AgoraSttListResponse>(
      `/agents?${query.toString()}`,
      {
        method: 'GET',
      },
    );

    if (Array.isArray(payload.agents)) {
      return payload.agents;
    }
    if (Array.isArray(payload.data)) {
      return payload.data;
    }
    if (Array.isArray(payload.data?.list)) {
      return payload.data.list;
    }
    return [];
  }

  private async findRunningSttAgent(sessionId: string) {
    try {
      const agents = await this.callAgoraSttList(sessionId);
      return (
        agents.find((agent) =>
          ['STARTED', 'RUNNING', '2', '3'].includes(String(agent.status).toUpperCase()),
        ) ??
        agents[0] ??
        null
      );
    } catch (error) {
      if (this.isAgoraSttUnavailableError(error)) {
        throw error;
      }
      this.logger.warn(
        `Failed to inspect Agora STT agents for meeting ${sessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private buildSttAgentName(sessionId: string) {
    return `meeting-stt-${sessionId}`.slice(0, 64);
  }

  private getSttPusherUid(sessionId: string) {
    const digest = crypto.createHash('sha256').update(`stt:${sessionId}`).digest();
    const raw = digest.readUInt32BE(0);
    return (raw % 900_000_000) + 10_000;
  }

  private toCanonicalDealStatus(status: string): CanonicalDealStatus {
    if (Object.values(DealStatus).includes(status as CanonicalDealStatus)) {
      return status as CanonicalDealStatus;
    }
    return DealStatus.Negotiating;
  }

  private parseAgoraPayload(rawText: string) {
    try {
      return JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return { raw: rawText } satisfies Record<string, unknown>;
    }
  }

  private extractAgoraErrorMessage(payload: Record<string, unknown>, statusCode: number) {
    const typedPayload = payload as AgoraSttErrorPayload;
    if (typedPayload.reason === 'ServiceNotEnabled') {
      return 'Project Agora hiện chưa bật dịch vụ Speech-to-Text.';
    }
    return (
      typedPayload.detail ??
      typedPayload.message ??
      typedPayload.error ??
      typedPayload.reason ??
      `Agora STT request failed with status ${statusCode}.`
    );
  }

  private isAgoraSttUnavailableError(error: unknown) {
    return (
      error instanceof HttpException &&
      error.getStatus() === 400 &&
      error.message.includes('Speech-to-Text')
    );
  }
}
