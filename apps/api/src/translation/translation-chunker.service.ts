import { Injectable, Logger } from '@nestjs/common';

interface ChunkMetadata {
  normalizedText: string;
  timestamp: number;
  speakerWallet?: string;
}

/**
 * TranslationChunker handles text chunking and deduplication for the
 * speech-to-speech translation pipeline.
 */
@Injectable()
export class TranslationChunker {
  private readonly logger = new Logger(TranslationChunker.name);
  private readonly seenChunks = new Map<string, ChunkMetadata>();
  private readonly speakerRateLimits = new Map<string, number[]>();

  // Configuration
  private readonly MAX_CHARS = 300;
  private readonly MAX_WORDS = 18;
  private readonly MIN_WORDS = 8;
  private readonly SENTENCE_ENDERS = /[.!?。！？]\s*$/;
  private readonly DEDUP_WINDOW_MS = 30_000;
  private readonly RATE_LIMIT_WINDOW_MS = 60_000;
  private readonly RATE_LIMIT_MAX = 30;
  private readonly MAX_CHUNK_DURATION_MS = 6_000;

  constructor() {
    this.logger.log('TranslationChunker initialized');
  }

  /**
   * Split text into translation-ready chunks.
   */
  chunk(text: string): string[] {
    if (!text || text.trim().length === 0) return [];

    const normalized = this.normalize(text);
    if (normalized.length === 0) return [];
    if (normalized.length <= this.MAX_CHARS) return [normalized];

    // Split on sentence boundaries if possible
    const sentences = normalized.split(/(?<=[.!?。！？])\s+/);
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if (current.length + sentence.length + 1 > this.MAX_CHARS && current.length > 0) {
        chunks.push(current.trim());
        current = '';
      }
      current += (current ? ' ' : '') + sentence;

      const wordCount = current.split(/\s+/).length;
      if (wordCount >= this.MAX_WORDS || current.length >= this.MAX_CHARS) {
        chunks.push(current.trim());
        current = '';
      }
    }

    if (current.trim().length > 0) {
      chunks.push(current.trim());
    }

    return chunks.length > 0 ? chunks : [normalized.slice(0, this.MAX_CHARS)];
  }

  /**
   * Check if a chunk is stable enough for TTS.
   */
  isStable(text: string): boolean {
    if (!text || text.trim().length === 0) return false;
    const trimmed = text.trim();
    // Check sentence enders
    if (this.SENTENCE_ENDERS.test(trimmed)) return true;
    // Check word count threshold
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount >= this.MAX_WORDS) return true;
    return false;
  }

  /**
   * Normalize text for deduplication.
   */
  normalize(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, '');
  }

  /**
   * Generate a hash for deduplication.
   */
  private hashText(text: string): string {
    const normalized = this.normalize(text);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(36);
  }

  /**
   * Check if text is a duplicate of a recently processed chunk.
   * Returns true if text was seen within DEDUP_WINDOW_MS.
   */
  isDuplicate(text: string): boolean {
    const normalized = this.normalize(text);
    const hash = this.hashText(normalized);

    // Exact hash match
    const seen = this.seenChunks.get(hash);
    if (seen) {
      const age = Date.now() - seen.timestamp;
      if (age < this.DEDUP_WINDOW_MS) return true;
      // Expired entry, remove it
      this.seenChunks.delete(hash);
    }

    // Check if text is a prefix of existing chunk (partial still coming in)
    for (const [, meta] of this.seenChunks) {
      const age = Date.now() - meta.timestamp;
      if (age >= this.DEDUP_WINDOW_MS) continue;
      // If normalized text is a prefix of an existing normalized text, it's a partial
      if (meta.normalizedText.startsWith(normalized)) {
        return true;
      }
    }

    // Record this chunk
    this.seenChunks.set(hash, { normalizedText: normalized, timestamp: Date.now() });
    this.pruneSeenChunks();
    return false;
  }

  /**
   * Check if a speaker is rate-limited.
   */
  isRateLimited(speakerWallet: string): boolean {
    const now = Date.now();
    const timestamps = this.speakerRateLimits.get(speakerWallet) ?? [];
    const recent = timestamps.filter((t) => now - t < this.RATE_LIMIT_WINDOW_MS);

    if (recent.length >= this.RATE_LIMIT_MAX) {
      return true;
    }

    recent.push(now);
    this.speakerRateLimits.set(speakerWallet, recent);
    return false;
  }

  private pruneSeenChunks(): void {
    if (this.seenChunks.size > 10_000) {
      const now = Date.now();
      for (const [key, meta] of this.seenChunks) {
        if (now - meta.timestamp > this.DEDUP_WINDOW_MS) {
          this.seenChunks.delete(key);
        }
      }
    }
  }
}
