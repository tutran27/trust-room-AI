import {
  Inject,
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { TranslationService } from './translation.service';
import { TranslateTranscriptDto } from './dto/translate-transcript.dto';

@Controller('translation')
export class TranslationController {
  private readonly logger = new Logger(TranslationController.name);

  constructor(
    @Inject(TranslationService)
    private readonly translationService: TranslationService,
  ) {}

  @Post('translate')
  @HttpCode(HttpStatus.OK)
  async translate(@Body() dto: TranslateTranscriptDto) {
    this.logger.debug(
      `Translate request: "${dto.text}" ${dto.source_lang}->${dto.target_lang}`,
    );
    return this.translationService.translate(dto);
  }

  @Post('tts')
  @HttpCode(HttpStatus.OK)
  async tts(
      @Body() body: { text: string; language: 'vi' | 'en'; meetingId?: string },
    ) {
    this.logger.debug(
      `TTS request: "${body.text}" lang=${body.language}`,
    );
    return this.translationService.textToSpeech(
      body.text,
      body.language,
      body.meetingId ?? 'api',
    );
  }

  @Post('speech-translate')
  @HttpCode(HttpStatus.OK)
  async speechTranslate(@Body() dto: TranslateTranscriptDto) {
    this.logger.debug(
      `Speech-translate request: "${dto.text}" ${dto.source_lang}->${dto.target_lang}`,
    );
    return this.translationService.speechTranslate(dto);
  }

  @Post('cache-stats')
  @HttpCode(HttpStatus.OK)
  async cacheStats() {
    return this.translationService.getCacheStats();
  }
}
