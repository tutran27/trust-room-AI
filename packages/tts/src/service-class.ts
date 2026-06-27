/**
 * TTSService class — wraps the TTS engine with state management.
 *
 * Supports:
 * - Speaker selection: choose whose speech gets voiced (buyer/seller/both)
 * - Demo mode: replay the current speaker's voice for testing
 * - Start/stop/cancel lifecycle
 */

import { speak, type TTSServiceOptions } from './service.js';
import type { TTSConfig } from './config.js';
import type { SpeakerLabel } from './types.js';
import { DEFAULT_CONFIG, loadConfig } from './config.js';
import { normalizeText } from './normalize.js';

export type TTSMode = 'live' | 'demo';

export class TTSService {
  private config: TTSConfig;
  private mode: TTSMode;
  private abortController: AbortController | null = null;
  private isSpeaking = false;

  /** Which speakers get TTS output */
  private speakerFilter: Set<SpeakerLabel> = new Set(['buyer', 'seller', 'ai']);

  constructor(config?: Partial<TTSConfig>, mode: TTSMode = 'demo') {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.mode = mode;
  }

  /** Load config from environment variables */
  loadEnvConfig(env: Record<string, string | undefined>): void {
    this.config = loadConfig(env);
  }

  /** Set which speakers should have their speech voiced */
  setSpeakerFilter(speakers: SpeakerLabel[]): void {
    this.speakerFilter = new Set(speakers);
  }

  /** Check if a speaker should get TTS output */
  shouldSpeak(speaker: SpeakerLabel): boolean {
    return this.speakerFilter.has(speaker);
  }

  /** Set TTS config at runtime */
  setConfig(partial: Partial<TTSConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /** Get current config */
  getConfig(): TTSConfig {
    return { ...this.config };
  }

  /** Set mode (live or demo) */
  setMode(mode: TTSMode): void {
    this.mode = mode;
  }

  /**
   * Speak the given text. Cancels any current speech.
   *
   * In demo mode, this always uses the Edge TTS provider (no key needed).
   *
   * @param text     Text to synthesise (can include emotion/SSML tags — stripped)
   * @param speaker  Which speaker said this text
   * @param callbacks Optional callbacks for UI updates
   */
  async speak(
    text: string,
    speaker: SpeakerLabel = 'ai',
    callbacks?: Pick<TTSServiceOptions, 'onSentence' | 'onAudio' | 'onDone'>,
  ): Promise<void> {
    // Check speaker filter
    if (!this.shouldSpeak(speaker)) return;

    const cleaned = normalizeText(text);
    if (!cleaned.trim()) return;

    // If already speaking, wait for current to finish before starting new
    if (this.isSpeaking) {
      console.log('[TTSService] busy, skipping:', text.slice(0, 40));
      return;
    }

    this.isSpeaking = true;
    this.abortController = new AbortController();

    const options: TTSServiceOptions = {
      config: this.config,
      signal: this.abortController.signal,
      ...callbacks,
    };

    // In demo mode, prefer Edge TTS (free), but respect user's provider choice
    if (this.mode === 'demo' && this.config.provider !== 'google') {
      options.config = { ...this.config, provider: 'edge' };
    }

    try {
      await speak(cleaned, options);
    } catch (err) {
      if (err instanceof Error && err.message.includes('aborted')) return;
      console.error('[TTSService] speak error:', err);
    } finally {
      this.isSpeaking = false;
      this.abortController = null;
    }
  }

  /**
   * Cancel any ongoing TTS output immediately.
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isSpeaking = false;
  }

  /** Whether TTS is currently speaking */
  get busy(): boolean {
    return this.isSpeaking;
  }

  /** Check if this instance is in demo mode */
  get demo(): boolean {
    return this.mode === 'demo';
  }
}
