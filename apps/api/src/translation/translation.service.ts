import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { TranslateTranscriptDto } from './dto/translate-transcript.dto';
import { TranslationChunker } from './translation-chunker.service';
import { TranslationCacheService } from './translation-cache.service';

interface TranslationResponse {
  translated_text: string;
  source_lang: string;
  target_lang: string;
  latency_ms: number;
}

interface TTSResponse {
  audio_base64: string | null;
  provider: string;
  latency_ms: number;
}

interface SpeechTranslateResponse {
  translated_text: string;
  audio_base64: string | null;
  translation_latency_ms: number;
  tts_latency_ms: number;
  total_latency_ms: number;
  tts_provider: string;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly pythonServiceUrl: string;
  private readonly translateTimeout: number;
  private readonly ttsTimeout: number;
  private readonly speechTranslateTimeout: number;

  private readonly chunker = new TranslationChunker();
  private _websocketGateway: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: TranslationCacheService,
    private readonly moduleRef: ModuleRef,
  ) {
    this.pythonServiceUrl =
      this.configService.get<string>('SPEECH_TRANSLATE_SERVICE_URL') ??
      'http://localhost:4100';
    this.translateTimeout =
      this.configService.get<number>('TRANSLATION_TIMEOUT_MS') ?? 3000;
    this.ttsTimeout =
      this.configService.get<number>('TTS_TIMEOUT_MS') ?? 5000;
    this.speechTranslateTimeout =
      this.configService.get<number>('SPEECH_TRANSLATE_TIMEOUT_MS') ?? 15000;
  }

  private get websocketGateway() {
    if (!this._websocketGateway) {
      try {
        this._websocketGateway = this.moduleRef.get('WebsocketGateway', { strict: false });
      } catch {
        this._websocketGateway = null;
      }
    }
    return this._websocketGateway;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit & { timeout?: number },
  ): Promise<Response> {
    const { timeout = 5000, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Health check for the Python speech translation service.
   */
  async healthCheck(): Promise<{ status: string; message?: string }> {
    try {
      const resp = await this.fetchWithTimeout(
        `${this.pythonServiceUrl}/health`,
        { method: 'GET', timeout: 2000 },
      );
      return (await resp.json()) as { status: string; message?: string };
    } catch {
      return { status: 'unavailable', message: 'Python speech translate service unreachable' };
    }
  }

  /**
   * Translate text from source_lang to target_lang using the Python service.
   * Checks cache first.
   */
  async translate(dto: TranslateTranscriptDto): Promise<TranslationResponse> {
    const cacheKey = this.cacheService.makeTranslationKey(
      dto.source_lang,
      dto.target_lang,
      dto.text,
    );
    const cached = this.cacheService.getTranslation(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const resp = await this.fetchWithTimeout(
        `${this.pythonServiceUrl}/translate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: dto.text,
            source_lang: dto.source_lang,
            target_lang: dto.target_lang,
          }),
          timeout: this.translateTimeout,
        },
      );
      if (!resp.ok) {
        const errorBody = await resp.text();
        throw new Error(`Translation service returned ${resp.status}: ${errorBody}`);
      }
      const result = (await resp.json()) as TranslationResponse;
      this.cacheService.setTranslation(cacheKey, result);
      return result;
    } catch (err: any) {
      this.logger.error(`Translation failed: ${err.message}`);
      // Emit error via socket
      this.websocketGateway.emitMeetingTranslationEvent(dto.meetingId, 'translation_error', {
        meetingId: dto.meetingId,
        transcriptId: dto.transcriptId,
        speakerWallet: dto.speakerWallet,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
      throw err;
    }
  }

  /**
   * Generate TTS audio for translated text.
   */
  async textToSpeech(
    text: string,
    language: 'vi' | 'en',
    meetingId: string,
  ): Promise<TTSResponse> {
    const cacheKey = this.cacheService.makeTTSKey(language, text);
    const cached = this.cacheService.getTTS(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const resp = await this.fetchWithTimeout(
        `${this.pythonServiceUrl}/tts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language }),
          timeout: this.ttsTimeout,
        },
      );
      if (!resp.ok) {
        const errorBody = await resp.text();
        throw new Error(`TTS service returned ${resp.status}: ${errorBody}`);
      }
      const result = (await resp.json()) as TTSResponse;
      this.cacheService.setTTS(cacheKey, result);
      return result;
    } catch (err: any) {
      this.logger.error(`TTS failed: ${err.message}`);
      // Return text-only fallback
      return {
        audio_base64: null,
        provider: 'none',
        latency_ms: 0,
      };
    }
  }

  /**
   * Full speech-to-speech translation pipeline: translate + TTS.
   */
  async speechTranslate(
    dto: TranslateTranscriptDto,
  ): Promise<SpeechTranslateResponse> {
    const startTime = Date.now();

    // Emit job created
    this.websocketGateway.emitMeetingTranslationEvent(
      dto.meetingId,
      'translation_job_created',
      {
        meetingId: dto.meetingId,
        transcriptId: dto.transcriptId,
        speakerWallet: dto.speakerWallet,
        timestamp: new Date().toISOString(),
      },
    );

    // Chunk the text first
    const chunks = this.chunker.chunk(dto.text);
    let combinedTranslation = '';
    let ttsAudioBase64: string | null = null;
    let ttsProvider = 'none';
    let ttsLatency = 0;

    for (const chunk of chunks) {
      try {
        // Translate
        const translateResult = await this.translate({
          ...dto,
          text: chunk,
        });
        combinedTranslation += (combinedTranslation ? ' ' : '') + translateResult.translated_text;

        // Only TTS for final/stable chunks
        if (dto.tts !== false && this.chunker.isStable(chunk)) {
          const ttsResult = await this.textToSpeech(
            translateResult.translated_text,
            dto.target_lang,
            dto.meetingId,
          );
          if (ttsResult.audio_base64) {
            ttsAudioBase64 = ttsResult.audio_base64;
          }
          ttsProvider = ttsResult.provider;
          ttsLatency += ttsResult.latency_ms;
        }
      } catch (err: any) {
        this.logger.warn(`Chunk translation failed: ${err.message}`);
        // Continue with next chunk
      }
    }

    const totalLatency = Date.now() - startTime;
    const translateLatency = totalLatency - ttsLatency;

    const result: SpeechTranslateResponse = {
      translated_text: combinedTranslation,
      audio_base64: ttsAudioBase64,
      translation_latency_ms: translateLatency,
      tts_latency_ms: ttsLatency,
      total_latency_ms: totalLatency,
      tts_provider: ttsProvider,
    };

    // Emit translated transcript
    this.websocketGateway.emitMeetingTranslationEvent(
      dto.meetingId,
      'translated_transcript',
      {
        meetingId: dto.meetingId,
        transcriptId: dto.transcriptId,
        speakerWallet: dto.speakerWallet,
        translated_text: combinedTranslation,
        source_lang: dto.source_lang,
        target_lang: dto.target_lang,
        timestamp: new Date().toISOString(),
      },
    );

    // Emit audio ready if we have audio
    if (ttsAudioBase64) {
      this.websocketGateway.emitMeetingTranslationAudio(
        dto.meetingId,
        {
          meetingId: dto.meetingId,
          audio_base64: ttsAudioBase64,
          translated_text: combinedTranslation,
          provider: ttsProvider,
          timestamp: new Date().toISOString(),
        },
      );
    }

    return result;
  }

  /**
   * Get cache stats from the cache service.
   */
  getCacheStats(): { translationEntries: number; ttsEntries: number } {
    return this.cacheService.getStats();
  }

  /**
   * Handle incoming transcript event from meetings service.
   * This is called by the meetings service or directly from the websocket gateway.
   */
  async handleTranscriptChunk(params: {
    meetingId: string;
    text: string;
    sourceLang?: 'vi' | 'en';
    targetLang?: 'vi' | 'en';
    transcriptId?: string;
    speakerWallet?: string;
    isFinal: boolean;
  }): Promise<void> {
    if (!params.isFinal) {
      // Partial transcript: display only, no TTS
      return;
    }

    // Check de-dup
    if (this.chunker.isDuplicate(params.text)) {
      this.logger.debug(`Duplicate chunk skipped: ${params.text}`);
      return;
    }

    // Rate limit check
    if (this.chunker.isRateLimited(params.speakerWallet ?? 'unknown')) {
      this.logger.warn(`Rate limited for speaker ${params.speakerWallet}`);
      return;
    }

    // Text length limit
    if (params.text.length > 300) {
      this.logger.debug(`Chunk too long (${params.text.length} chars), truncating`);
    }

    const sourceLang = params.sourceLang ?? 'vi';
    const targetLang = params.targetLang ?? 'en';

    const dto = new TranslateTranscriptDto();
    dto.text = params.text;
    dto.source_lang = sourceLang;
    dto.target_lang = targetLang;
    dto.meetingId = params.meetingId;
    dto.transcriptId = params.transcriptId;
    dto.speakerWallet = params.speakerWallet;
    dto.tts = true;

    try {
      await this.speechTranslate(dto);
    } catch (err: any) {
      this.logger.error(`handleTranscriptChunk failed: ${err.message}`);
      this.websocketGateway.emitMeetingTranslationEvent(
        params.meetingId,
        'translation_error',
        {
          meetingId: params.meetingId,
          transcriptId: params.transcriptId,
          speakerWallet: params.speakerWallet,
          error: err.message,
          timestamp: new Date().toISOString(),
        },
      );
    }
  }
}
