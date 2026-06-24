/**
 * Core types for the TTS engine.
 *
 * Every TTS provider yields PCM int16 frames (24 kHz mono) — the standard
 * raw audio format consumed by the loudness chain and the meeting output
 * device.
 */

/** PCM int16 frame — one chunk of raw audio at 24 kHz */
export type AudioFrame = Int16Array;

/** Language hint for voice selection */
export type LanguageCode = 'vi' | 'en' | 'mixed';

/** A chunk of text known to be a single language */
export interface LangChunk {
  lang: 'vi' | 'en';
  text: string;
}

/** Result of text normalisation */
export interface NormalizedText {
  raw: string;
  cleaned: string;
  lang: LanguageCode;
}

/** Sentence marker — pushed to the queue so the consumer can update UI */
export interface SentenceMarker {
  type: 'sentence';
  text: string;
  lang: LanguageCode;
}

/** Audio frame with metadata */
export interface AudioFramePacket {
  type: 'audio';
  data: Int16Array;
  /** Sequence number for ordering */
  seq: number;
  /** Which language this frame was synthesised for */
  lang: LanguageCode;
}

/** Queue item — either a marker or raw audio */
export type QueueItem = SentenceMarker | AudioFramePacket;

/** Control values for the loudness chain */
export interface LoudnessParams {
  targetRms: number;
  maxPeak: number;
  maxBoostDb: number;
  compressorThreshold: number;
  compressorRatio: number;
  softclipDrive: number;
}

/** Synthesize function signature expected from every provider */
export type SynthesizeFn = (
  text: string,
  lang: 'vi' | 'en',
  config: { voice: string; speed: number; rate?: string },
  signal?: AbortSignal,
) => AsyncGenerator<Int16Array, void, unknown>;

/** TTS provider interface */
export interface TTSProvider {
  name: string;
  /** Whether this provider is available right now */
  available: () => boolean;
  synthesize: SynthesizeFn;
}

/** Speaker label for demo mode */
export type SpeakerLabel = 'buyer' | 'seller' | 'ai' | 'system';
