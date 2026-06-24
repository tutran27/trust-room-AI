import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TTSService, loadConfig, synthesizeToBuffer, type TTSConfig } from '@trustroom/tts';
import { WebsocketGateway } from '../websocket/websocket.gateway';

export interface SpeakToMeetingOptions {
  speaker: string;
  userId: string;
  /** Nếu true thì translate EN→VI trước khi TTS */
  translate?: boolean;
}
@Injectable()
export class AiVoiceService {
  private readonly logger = new Logger(AiVoiceService.name);
  private readonly tts: TTSService;
  private readonly activeMeetings = new Map<string, TTSService>();

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(WebsocketGateway) private readonly ws: WebsocketGateway,
  ) {
    const env = {
      TTS_PROVIDER: this.configService.get<string>('TTS_PROVIDER'),
      GOOGLE_TTS_API_KEY: this.configService.get<string>('GOOGLE_TTS_API_KEY'),
      GOOGLE_TTS_VOICE_VI: this.configService.get<string>('GOOGLE_TTS_VOICE_VI'),
      GOOGLE_TTS_VOICE_EN: this.configService.get<string>('GOOGLE_TTS_VOICE_EN'),
      GOOGLE_TTS_SPEED_VI: this.configService.get<string>('GOOGLE_TTS_SPEED_VI'),
      GOOGLE_TTS_SPEED_EN: this.configService.get<string>('GOOGLE_TTS_SPEED_EN'),
      EDGE_TTS_VOICE_VI: this.configService.get<string>('EDGE_TTS_VOICE_VI'),
      EDGE_TTS_VOICE_EN: this.configService.get<string>('EDGE_TTS_VOICE_EN'),
      EDGE_TTS_RATE_VI: this.configService.get<string>('EDGE_TTS_RATE_VI'),
      EDGE_TTS_RATE_EN: this.configService.get<string>('EDGE_TTS_RATE_EN'),
      TTS_TARGET_RMS: this.configService.get<string>('TTS_TARGET_RMS'),
      TTS_MAX_PEAK: this.configService.get<string>('TTS_MAX_PEAK'),
      TTS_MAX_BOOST_DB: this.configService.get<string>('TTS_MAX_BOOST_DB'),
      TTS_COMPRESSOR_THRESHOLD: this.configService.get<string>('TTS_COMPRESSOR_THRESHOLD'),
      TTS_COMPRESSOR_RATIO: this.configService.get<string>('TTS_COMPRESSOR_RATIO'),
      TTS_SOFTCLIP_DRIVE: this.configService.get<string>('TTS_SOFTCLIP_DRIVE'),
    };
    const config = loadConfig(env as Record<string, string | undefined>);
    this.tts = new TTSService(config, 'demo');

    this.logger.log(`TTS_PROVIDER=${env.TTS_PROVIDER ?? 'unset'}`);
    this.logger.log(`GOOGLE_TTS_API_KEY=${env.GOOGLE_TTS_API_KEY ? config.googleApiKey.slice(0, 10) + '... (loaded)' : 'MISSING'}`);
    this.logger.log(`google available=${!!config.googleApiKey}`);
  }

  setSpeakerFilter(meetingId: string, speakers: Array<'buyer' | 'seller' | 'ai' | 'system'>): void {
    const svc = this.getOrCreateMeetingService(meetingId);
    svc.setSpeakerFilter(speakers);
  }

  async synthesizeToBuffer(text: string, demoMode: boolean): Promise<Int16Array | null> {
    if (demoMode) {
      const env = { TTS_PROVIDER: 'edge' } as Record<string, string | undefined>;
      const config = loadConfig(env);
      return synthesizeToBuffer(text, config);
    }
    return synthesizeToBuffer(text, this.tts.getConfig());
  }

  /**
   * Phát hiện text có phải tiếng Anh không và translate → VI trước khi TTS.
   */
  async speakToMeeting(meetingId: string, text: string, options: SpeakToMeetingOptions): Promise<void> {
    const svc = this.getOrCreateMeetingService(meetingId);
    const ws = this.ws;
    let seq = 0;

    this.logger.log(`TTS nhận: "${text.slice(0, 60)}..."`);

    // 1. Translate EN→VI nếu được yêu cầu
    let ttsText = text;
    if (options.translate) {
      try {
        this.logger.log(`Đang translate EN→VI...`);
        ttsText = await this.translateToVietnamese(text);
        this.logger.log(`Đã dịch: "${ttsText.slice(0, 60)}..."`);
      } catch (err) {
        this.logger.warn(`Translate thất bại: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. TTS
    try {
      await svc.speak(ttsText, 'ai', {
        onSentence: (sentenceText: string, lang: string) => {
          ws.emitMeetingTtsSentence(meetingId, {
            id: `tts-${Date.now()}`,
            speakerLabel: 'ai',
            content: sentenceText,
            language: lang,
            startTime: Date.now(),
          });
        },

        onAudio: (pcm: Int16Array, frameSeq: number) => {
          const base64 = Buffer.from(pcm.buffer).toString('base64');
          ws.emitMeetingTtsAudio(meetingId, {
            seq: frameSeq,
            audio: base64,
            sampleRate: 24000,
            channels: 1,
            format: 'pcm_int16',
            timestamp: Date.now(),
          });
          seq = frameSeq;
        },

        onDone: () => {
          ws.emitMeetingTtsDone(meetingId, { seq, timestamp: Date.now() });
        },
      });
      this.logger.log(`TTS done cho meeting ${meetingId}`);
    } catch (err) {
      this.logger.error(`TTS failed: ${err instanceof Error ? err.message : String(err)}`, err instanceof Error ? err.stack : undefined);
      ws.emitMeetingTtsDone(meetingId, { seq, timestamp: Date.now(), error: err instanceof Error ? err.message : 'TTS failed' });
    }
  }

  cancelMeetingTts(meetingId: string): void {
    const svc = this.activeMeetings.get(meetingId);
    if (svc) svc.cancel();
  }

  // ─── English detection ────────────────────────────────────────────
  private isEnglish(text: string): boolean {
    // Có dấu tiếng Việt → chắc chắn là VI
    if (/[àáảãạăắằẵặâấầẫậđèéẻẽẹêếềễệìíỉĩịòóỏõọôốồỗộơớờỡợùúủũụưứừữựỳỹỷỵ]/.test(text.toLowerCase())) {
      return false;
    }
    const cleaned = text.replace(/[^a-zA-Z\s]/g, '').trim();
    if (cleaned.length < 4) return false;
    const enWords = new Set(['the','is','are','was','were','have','has','this','that','with','for','you','your',
      'please','hello','hi','yes','no','ok','okay','thanks','thank','good','my','name','and','but','not','here',
      'there','can','will','would','could','should','may','send','receive','transfer','deposit','release',
      'payment','money','funds','token','deal','trade','buy','sell','price','amount','check','confirm']);
    const words = text.toLowerCase().split(/\s+/);
    const enCount = words.filter(w => enWords.has(w)).length;
    return enCount >= 2 || cleaned.length / Math.max(text.length, 1) > 0.6;
  }

  // ─── LLM Translation (Groq) ────────────────────────────────────────
  private async translateToVietnamese(text: string): Promise<string> {
    const { getLLMClient } = await import('@trustroom/ai');
    const groqKey = this.configService.get<string>('GROQ_API_KEY') ?? process.env.GROQ_API_KEY;
    const model = this.configService.get<string>('GROQ_MODEL') ?? 'llama-3.1-8b-instant';
    if (!groqKey) return text;

    const llm = getLLMClient({ model, temperature: 0.1, maxTokens: 256 } as any);

    try {
      const translated = await llm.chat([
        { role: 'system', content: 'Bạn là phiên dịch realtime cho cuộc họp. Dịch tiếng Anh→Việt tự nhiên, chính xác, sửa lỗi ngữ pháp. Giữ nguyên thuật ngữ kỹ thuật (API, SDK, WebSocket, token, escrow, deal), số, địa chỉ ví, tên riêng. Nếu text đã là tiếng Việt hoặc không chắc → trả về giống hệt text gốc. CHỈ trả về bản dịch, không thêm gì khác.' },
        { role: 'user', content: text },
      ]);
      return (translated?.trim() || text).replace(/^Dịch:\s*/i, '');
    } catch {
      return text;
    }
  }

  private getOrCreateMeetingService(meetingId: string): TTSService {
    let svc = this.activeMeetings.get(meetingId);
    if (!svc) {
      svc = new TTSService(this.tts.getConfig(), 'demo');
      this.activeMeetings.set(meetingId, svc);
    }
    return svc;
  }
}
