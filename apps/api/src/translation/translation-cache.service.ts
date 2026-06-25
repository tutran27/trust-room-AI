import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class TranslationCacheService {
  private readonly logger = new Logger(TranslationCacheService.name);
  private readonly translationCache = new Map<string, CacheEntry<any>>();
  private readonly ttsCache = new Map<string, CacheEntry<any>>();
  private readonly translationTTL: number;
  private readonly ttsTTL: number;

  constructor() {
    // Default TTLs: 5 minutes for translations, 10 minutes for TTS
    this.translationTTL = 5 * 60 * 1000;
    this.ttsTTL = 10 * 60 * 1000;

    // Periodic cleanup every 60 seconds
    setInterval(() => this.cleanup(), 60_000);
  }

  private hash(text: string): string {
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.translationCache) {
      if (entry.expiresAt < now) {
        this.translationCache.delete(key);
        cleaned++;
      }
    }
    for (const [key, entry] of this.ttsCache) {
      if (entry.expiresAt < now) {
        this.ttsCache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Build a cache key for translation: sourceLang + targetLang + normalizedText
   */
  makeTranslationKey(
    sourceLang: string,
    targetLang: string,
    text: string,
  ): string {
    const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
    return `tr:${sourceLang}:${targetLang}:${this.hash(normalized)}`;
  }

  /**
   * Build a cache key for TTS: language + text hash
   */
  makeTTSKey(language: string, text: string): string {
    const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
    return `tts:${language}:${this.hash(normalized)}`;
  }

  getTranslation(key: string): any | null {
    const entry = this.translationCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.translationCache.delete(key);
      return null;
    }
    return entry.value;
  }

  setTranslation(key: string, value: any): void {
    this.translationCache.set(key, {
      value,
      expiresAt: Date.now() + this.translationTTL,
    });
  }

  getTTS(key: string): any | null {
    const entry = this.ttsCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.ttsCache.delete(key);
      return null;
    }
    return entry.value;
  }

  setTTS(key: string, value: any): void {
    this.ttsCache.set(key, {
      value,
      expiresAt: Date.now() + this.ttsTTL,
    });
  }

  /** Get cache stats for health/debug */
  getStats(): { translationEntries: number; ttsEntries: number } {
    return {
      translationEntries: this.translationCache.size,
      ttsEntries: this.ttsCache.size,
    };
  }
}