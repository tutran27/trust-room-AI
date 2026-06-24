/**
 * TTS Engine configuration — loaded from environment variables.
 *
 * Users self-configure their own API keys. Edge TTS requires no key (free).
 */

export interface TTSConfig {
  /** "google" | "edge" */
  provider: string;

  // ─── Google Cloud TTS ──────────────────────────────────────────────
  googleApiKey: string;
  googleVoiceVi: string;
  googleVoiceEn: string;
  googleSpeedVi: number;
  googleSpeedEn: number;

  // ─── Edge TTS (free, no key needed) ─────────────────────────────────
  edgeVoiceVi: string;
  edgeVoiceEn: string;
  edgeRateVi: string;
  edgeRateEn: string;

  // ─── Audio processing ──────────────────────────────────────────────
  targetRms: number;
  maxPeak: number;
  maxBoostDb: number;
  compressorThreshold: number;
  compressorRatio: number;
  softclipDrive: number;
}

export const DEFAULT_CONFIG: TTSConfig = {
  provider: 'edge',
  googleApiKey: '',
  googleVoiceVi: 'vi-VN-Neural2-A',
  googleVoiceEn: 'en-US-Neural2-F',
  googleSpeedVi: 0.96,
  googleSpeedEn: 0.89,
  edgeVoiceVi: 'vi-VN-HoaiMyNeural',
  edgeVoiceEn: 'en-US-JennyNeural',
  edgeRateVi: '+0%',
  edgeRateEn: '+0%',
  targetRms: 9500,
  maxPeak: 30000,
  maxBoostDb: 18,
  compressorThreshold: 0.70,
  compressorRatio: 3.0,
  softclipDrive: 1.6,
};

/**
 * Load config from environment variables (with defaults).
 * Call once at app startup.
 */
export function loadConfig(env: Record<string, string | undefined>): TTSConfig {
  return {
    provider: env.TTS_PROVIDER ?? DEFAULT_CONFIG.provider,
    googleApiKey: env.GOOGLE_TTS_API_KEY ?? '',
    googleVoiceVi: env.GOOGLE_TTS_VOICE_VI ?? DEFAULT_CONFIG.googleVoiceVi,
    googleVoiceEn: env.GOOGLE_TTS_VOICE_EN ?? DEFAULT_CONFIG.googleVoiceEn,
    googleSpeedVi: parseFloat(env.GOOGLE_TTS_SPEED_VI ?? String(DEFAULT_CONFIG.googleSpeedVi)),
    googleSpeedEn: parseFloat(env.GOOGLE_TTS_SPEED_EN ?? String(DEFAULT_CONFIG.googleSpeedEn)),
    edgeVoiceVi: env.EDGE_TTS_VOICE_VI ?? DEFAULT_CONFIG.edgeVoiceVi,
    edgeVoiceEn: env.EDGE_TTS_VOICE_EN ?? DEFAULT_CONFIG.edgeVoiceEn,
    edgeRateVi: env.EDGE_TTS_RATE_VI ?? DEFAULT_CONFIG.edgeRateVi,
    edgeRateEn: env.EDGE_TTS_RATE_EN ?? DEFAULT_CONFIG.edgeRateEn,
    targetRms: parseInt(env.TTS_TARGET_RMS ?? String(DEFAULT_CONFIG.targetRms), 10),
    maxPeak: parseInt(env.TTS_MAX_PEAK ?? String(DEFAULT_CONFIG.maxPeak), 10),
    maxBoostDb: parseInt(env.TTS_MAX_BOOST_DB ?? String(DEFAULT_CONFIG.maxBoostDb), 10),
    compressorThreshold: parseFloat(env.TTS_COMPRESSOR_THRESHOLD ?? String(DEFAULT_CONFIG.compressorThreshold)),
    compressorRatio: parseFloat(env.TTS_COMPRESSOR_RATIO ?? String(DEFAULT_CONFIG.compressorRatio)),
    softclipDrive: parseFloat(env.TTS_SOFTCLIP_DRIVE ?? String(DEFAULT_CONFIG.softclipDrive)),
  };
}
