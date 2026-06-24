/**
 * @trustroom/tts — Text‑to‑Speech engine for TrustRoom AI meetings.
 *
 * Entry point that exports all public types and the main service.
 */

export { TTSService } from './service-class';
export { speak, synthesizeToBuffer } from './service';
export type { TTSServiceOptions, SentenceCallback, AudioFrameCallback } from './service';
export { loadConfig, type TTSConfig, DEFAULT_CONFIG } from './config';
export type {
  AudioFrame,
  LanguageCode,
  LangChunk,
  QueueItem,
  SentenceMarker,
  AudioFramePacket,
  LoudnessParams,
  TTSProvider,
  SpeakerLabel,
} from './types';
export { normalizeText, sanitizeSsmlText } from './normalize';
export { detectLanguageChunks, guessLanguage } from './language';
export { applyAliases, normalizeEnglishText, EN_ALIAS_MAP, EN_CHARACTER_TOKENS } from './pronounce';
export { buildSsml, buildSsmlInline } from './ssml';
export { splitClauses } from './chunk';
export { processLoudnessChain } from './audio';
export { createGoogleProvider } from './providers/google-tts';
export { createEdgeProvider } from './providers/edge-tts';
