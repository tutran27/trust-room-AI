import { Controller, Post, Get, Param, Body, Inject, Logger } from '@nestjs/common';
import { AiVoiceService } from './ai-voice.service';

@Controller('ai-voice')
export class AiVoiceController {
  constructor(
    @Inject(AiVoiceService) private readonly aiVoice: AiVoiceService,
  ) {}

  /**
   * Demo endpoint: synthesise text and return base64 PCM audio.
   * No meeting needed — just test the TTS voice quality.
   */
  @Post('speak')
  async speakDemo(
    @Body() dto: { text: string; demoMode?: boolean },
  ) {
    const pcm = await this.aiVoice.synthesizeToBuffer(
      dto.text,
      dto.demoMode !== false,
    );
    if (!pcm) {
      return { audio: null, message: 'No TTS provider available' };
    }
    return {
      audio: Buffer.from(pcm.buffer).toString('base64'),
      sampleRate: 24000,
      channels: 1,
      format: 'pcm_int16',
    };
  }

  /**
   * Speak text in a meeting — sends PCM frames over WebSocket.
   */
  @Post('meeting/:meetingId/speak')
  async speakInMeeting(
    @Param('meetingId') meetingId: string,
    @Body() dto: { text: string; speaker?: string; translate?: boolean },
  ) {
    const logger = new Logger('AiVoiceController');
    logger.log(`speakInMeeting: meeting=${meetingId} text="${dto.text?.slice(0, 60)}" translate=${dto.translate}`);

    this.aiVoice.speakToMeeting(meetingId, dto.text, {
      speaker: dto.speaker ?? 'ai',
      userId: dto.speaker ?? 'ai',
      translate: dto.translate ?? false,
    }).catch((err: unknown) => {
      logger.error(`TTS speakToMeeting failed: ${err instanceof Error ? err.message : String(err)}`);
    });
    return { queued: true };
  }

  /**
   * Cancel current TTS output for a meeting.
   */
  @Post('meeting/:meetingId/cancel')
  cancelMeetingTts(@Param('meetingId') meetingId: string) {
    this.aiVoice.cancelMeetingTts(meetingId);
    return { cancelled: true };
  }
}
