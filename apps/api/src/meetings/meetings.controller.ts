import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/authenticated-request';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateInviteDto, JoinByTokenDto } from './dto/invite.dto';
import { UpdateMeetingStatusDto } from './dto/meeting-status.dto';
import { AddTranscriptDto } from './dto/transcript.dto';
import { AddTranslationDto } from './dto/translation.dto';
import { AddRiskEventDto } from './dto/risk-event.dto';
import { GetAgoraTokenDto } from './dto/agora-token.dto';
import { StartMeetingSttDto } from './dto/stt.dto';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(@Inject(MeetingsService) private readonly meetings: MeetingsService) {}

  @Post()
  create(@Body() dto: CreateMeetingDto, @Req() req: AuthenticatedRequest) {
    return this.meetings.create(dto, req.user.wallet);
  }

  @Get('deal/:dealId')
  findByDeal(@Param('dealId') dealId: string) {
    return this.meetings.findByDeal(dealId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.meetings.findById(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMeetingStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.meetings.updateStatus(id, dto.status, req.user.wallet);
  }

  @Post(':id/invites')
  createInvite(
    @Param('id') id: string,
    @Body() dto: CreateInviteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.meetings.createInvite(
      id,
      req.user.wallet,
      dto.walletAddress ?? null,
      dto.role,
      dto.maxUses ?? 1,
      new Date(dto.expiresAt),
    );
  }

  @Post('join')
  joinByToken(@Body() dto: JoinByTokenDto, @Req() req: AuthenticatedRequest) {
    return this.meetings.joinByToken(dto.token, req.user.wallet);
  }

  @Post(':id/leave')
  leave(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.meetings.removeParticipant(id, req.user.wallet);
  }

  @Get(':id/transcripts')
  transcripts(@Param('id') id: string) {
    return this.meetings.getTranscripts(id);
  }

  @Post(':id/transcripts')
  addTranscript(@Param('id') id: string, @Body() dto: AddTranscriptDto) {
    return this.meetings.addTranscript({ ...dto, sessionId: id });
  }

  @Post(':id/translations')
  addTranslation(@Param('id') id: string, @Body() dto: AddTranslationDto) {
    return this.meetings.addTranslation({ ...dto, sessionId: id });
  }

  @Get(':id/risk-events')
  riskEvents(@Param('id') id: string) {
    return this.meetings.getRiskEvents(id);
  }

  @Post(':id/risk-events')
  addRiskEvent(@Param('id') id: string, @Body() dto: AddRiskEventDto) {
    return this.meetings.addRiskEvent({ ...dto, sessionId: id });
  }

  @Get(':id/agora-token')
  getAgoraToken(@Param('id') id: string, @Query() query: GetAgoraTokenDto) {
    const uid = Number(query.uid);
    const role = query.role === undefined ? 1 : Number(query.role);
    const expiry = query.expiry === undefined ? 3600 : Number(query.expiry);

    return this.meetings.getAgoraTokenPayload(id, uid, role, expiry);
  }

  @Get(':id/stt')
  getSttState(@Param('id') id: string) {
    return this.meetings.getSttState(id);
  }

  @Post(':id/stt/start')
  startStt(
    @Param('id') id: string,
    @Body() dto: StartMeetingSttDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.meetings.startSttAgent(id, req.user.wallet, dto);
  }

  @Post(':id/stt/stop')
  stopStt(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.meetings.stopSttAgent(id, req.user.wallet);
  }

  @Post(':id/stt/groq-transcribe')
  @UseInterceptors(FileInterceptor('audio'))
  groqTranscribe(
    @Param('id') id: string,
    @UploadedFile() audio: Express.Multer.File,
  ) {
    return this.meetings.groqTranscribe(id, audio);
  }
}
