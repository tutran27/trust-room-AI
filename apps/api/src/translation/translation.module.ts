import { Module } from '@nestjs/common';
import { TranslationController } from './translation.controller';
import { TranslationService } from './translation.service';
import { TranslationChunker } from './translation-chunker.service';
import { TranslationCacheService } from './translation-cache.service';

@Module({
  controllers: [TranslationController],
  providers: [
    TranslationService,
    TranslationCacheService,
    TranslationChunker,
  ],
  exports: [TranslationService, TranslationCacheService],
})
export class TranslationModule {}
