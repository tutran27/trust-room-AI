/**
 * TTSService — the main TTS engine.
 *
 * Orchestrates:
 * 1. Text normalisation
 * 2. Clause splitting (parallel pre‑fetch)
 * 3. Language detection (mixed VI‑EN)
 * 4. Provider selection with Google → Edge fallback
 * 5. SSML building
 * 6. Synthesis via chosen provider
 * 7. Loudness chain
 * 8. Producer/consumer queue for speed-to-speed
 *
 * "speed-to-speed" means: first clause is synthesised and sent to the
 * output device while subsequent clauses are still being generated.
 */

import type { TTSConfig } from './config';
import type { TTSProvider, SpeakerLabel } from './types';
import { createGoogleProvider } from './providers/google-tts';
import { createEdgeProvider } from './providers/edge-tts';
import { normalizeText } from './normalize';
import { detectLanguageChunks, guessLanguage } from './language';
import { splitClauses, type Clause } from './chunk';
import { processLoudnessChain } from './audio';
import { DEFAULT_CONFIG } from './config';

const SENTENCE_MARKER = '__sentence__';
const DONE = '__done__';

/** Callback fired when a new sentence starts being synthesised */
export interface SentenceCallback {
  (text: string, lang: string): void;
}

/** Callback fired for each audio frame */
export interface AudioFrameCallback {
  (pcm: Int16Array, seq: number): void;
}

export interface TTSServiceOptions {
  config?: Partial<TTSConfig>;
  /** Called when each sentence marker is dequeued (for UI subtitles) */
  onSentence?: SentenceCallback;
  /** Called for each PCM frame ready for output */
  onAudio?: AudioFrameCallback;
  /** Called when the queue is fully drained */
  onDone?: () => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Speaker selection for which voices to output */
  speakerFilter?: SpeakerLabel[];
}

/**
 * Synthesize full text via the speed‑to‑speed pipeline.
 *
 * The text is split into clauses. Each clause is independently synthesised
 * and frames are pushed to the queue. The consumer drains the queue with
 * pacing so the first audio reaches the output device before the LLM has
 * finished generating the rest of the response.
 *
 * @param text    The full text to speak
 * @param options Callbacks and configuration
 */
export async function speak(text: string, options: TTSServiceOptions): Promise<void> {
  const config: TTSConfig = { ...DEFAULT_CONFIG, ...options.config };
  const signal = options.signal;
  const onSentence = options.onSentence;
  const onAudio = options.onAudio;
  const onDone = options.onDone;

  console.log(`[TTS:speak] provider=${config.provider} text="${text.slice(0, 80)}"`);

  // 1. Normalise
  const cleaned = normalizeText(text);
  if (!cleaned.trim()) {
    console.log('[TTS:speak] empty after normalize');
    onDone?.();
    return;
  }

  // 2. Detect overall language
  const overallLang = guessLanguage(cleaned);
  console.log(`[TTS:speak] overallLang=${overallLang} cleaned="${cleaned.slice(0, 80)}"`);

  // 3. Split into clauses
  const clauses = splitClauses(cleaned);
  console.log(`[TTS:speak] clauses=${clauses.length}`);
  if (clauses.length === 0) {
    onDone?.();
    return;
  }

  // 4. Select provider
  const provider = selectProvider(config);
  if (!provider) {
    console.warn('[TTS] No TTS provider available (Google key missing and Edge TTS unavailable).');
    onDone?.();
    return;
  }
  console.log(`[TTS:speak] selected provider=${provider.name}`);

  // 5. Build voice config for the provider
  const voiceConfig = buildVoiceConfig(config, overallLang);

  // 6. Create queue & run producer/consumer
  const hasMultipleClauses = clauses.length > 1;
  let seq = 0;

  // Signal the first sentence immediately for UI
  if (onSentence) {
    onSentence(clauses[0]!.text, clauses[0]!.lang);
  }

  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i]!;

    if (signal?.aborted) {
      console.log('[TTS:speak] aborted mid-clause');
      break;
    }

    try {
      const lang = clause.lang === 'mixed' ? 'vi' as const : clause.lang;
      const langVoiceConfig = buildVoiceConfig(config, lang);

      console.log(`[TTS:speak] clause ${i}/${clauses.length}: lang=${lang} text="${clause.text.slice(0, 60)}"`);

      for await (const rawPcm of provider.synthesize(clause.text, lang, langVoiceConfig, signal)) {
        if (signal?.aborted) break;

        const processed = processLoudnessChain(rawPcm, {
          targetRms: config.targetRms,
          maxPeak: config.maxPeak,
          maxBoostDb: config.maxBoostDb,
          compressorThreshold: config.compressorThreshold,
          compressorRatio: config.compressorRatio,
          softclipDrive: config.softclipDrive,
        });

        const frameSeq = seq++;
        if (onAudio) {
          onAudio(processed, frameSeq);
        }
      }

      console.log(`[TTS:speak] clause ${i} done (${seq} frames so far)`);

      if (hasMultipleClauses && i + 1 < clauses.length && onSentence) {
        onSentence(clauses[i + 1]!.text, clauses[i + 1]!.lang);
      }
    } catch (err) {
      console.warn(`[TTS] Clause ${i} failed:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log(`[TTS:speak] done — total frames=${seq}`);
  onDone?.();
}

/**
 * Synthesize text and return raw audio bytes (for file/preview use).
 *
 * Unlike speak(), this collects ALL audio into a single buffer.
 */
export async function synthesizeToBuffer(
  text: string,
  config?: Partial<TTSConfig>,
): Promise<Int16Array | null> {
  const fullConfig: TTSConfig = { ...DEFAULT_CONFIG, ...config };
  const cleaned = normalizeText(text);
  if (!cleaned.trim()) return null;

  const provider = selectProvider(fullConfig);
  if (!provider) return null;

  const clauses = splitClauses(cleaned);
  const allFrames: Int16Array[] = [];
  let totalLength = 0;

  for (const clause of clauses) {
    const lang = clause.lang === 'mixed' ? 'vi' as const : clause.lang;
    const voiceConfig = buildVoiceConfig(fullConfig, lang);

    for await (const rawPcm of provider.synthesize(clause.text, lang, voiceConfig)) {
      const processed = processLoudnessChain(rawPcm, fullConfig);
      allFrames.push(processed);
      totalLength += processed.length;
    }
  }

  // Merge all frames into one buffer
  const merged = new Int16Array(totalLength);
  let offset = 0;
  for (const frame of allFrames) {
    merged.set(frame, offset);
    offset += frame.length;
  }

  return merged;
}

// ─── Internal helpers ─────────────────────────────────────────────────

function selectProvider(config: TTSConfig): TTSProvider | null {
  const googleProvider = createGoogleProvider(config);
  if (config.provider === 'google' && googleProvider.available()) {
    return googleProvider;
  }

  const edgeProvider = createEdgeProvider(config);
  if (edgeProvider.available()) {
    return edgeProvider;
  }

  // Fallback: try Google even if Edge was requested
  if (googleProvider.available()) {
    return googleProvider;
  }

  return null;
}

function buildVoiceConfig(
  config: TTSConfig,
  lang: string,
): { voice: string; speed: number; rate?: string } {
  if (lang === 'en') {
    return {
      voice: config.edgeVoiceEn,
      speed: 1.0,
      rate: config.edgeRateEn,
    };
  }
  return {
    voice: config.edgeVoiceVi,
    speed: 1.0,
    rate: config.edgeRateVi,
  };
}
