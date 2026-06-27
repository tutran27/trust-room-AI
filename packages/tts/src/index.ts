/**
 * @trustroom/tts — Text‑to‑Speech engine for TrustRoom AI meetings.
 *
 * Entry point that exports all public types and the main service.
 */

export { TTSService } from './service-class.js';
export { speak, synthesizeToBuffer } from './service.js';
export type { TTSServiceOptions, SentenceCallback, AudioFrameCallback } from './service.js';
export { loadConfig, type TTSConfig, DEFAULT_CONFIG } from './config.js';
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
} from './types.js';
export { normalizeText, sanitizeSsmlText } from './normalize.js';
export { detectLanguageChunks, guessLanguage } from './language.js';
export { applyAliases, normalizeEnglishText, EN_ALIAS_MAP, EN_CHARACTER_TOKENS } from './pronounce.js';
export { buildSsml, buildSsmlInline } from './ssml.js';
export { splitClauses } from './chunk.js';
export { processLoudnessChain } from './audio.js';
export { createGoogleProvider } from './providers/google-tts.js';
export { createEdgeProvider } from './providers/edge-tts.js';
