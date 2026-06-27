/**
 * Google Cloud Text‑to‑Speech provider.
 *
 * Uses the REST API to synthesize speech. Returns raw PCM audio at 24 kHz.
 * Falls back gracefully when no API key is configured.
 */

import type { TTSProvider } from '../types.js';
import { buildSsml } from '../ssml.js';
import { detectLanguageChunks } from '../language.js';
import { normalizeEnglishText } from '../pronounce.js';
import type { TTSConfig } from '../config.js';

const GOOGLE_TTS_URL =
  'https://texttospeech.googleapis.com/v1/text:synthesize';

const FRAME_SIZE = 1440; // 24000 * 0.060

export function createGoogleProvider(config: TTSConfig): TTSProvider {
  const apiKey = config.googleApiKey;
  const voices = { vi: config.googleVoiceVi, en: config.googleVoiceEn };
  const speeds = { vi: config.googleSpeedVi, en: config.googleSpeedEn };

  return {
    name: 'google',
    available: () => !!apiKey,

    async *synthesize(text, lang, _voiceOpts, signal) {
      if (!text.trim()) return;

      console.log(`[GoogleTTS] synthesize: lang=${lang} text="${text.slice(0, 60)}"`);

      const chunks = detectLanguageChunks(text);
      const processedChunks = chunks.map((c) => ({
        ...c,
        text: c.lang === 'en' ? normalizeEnglishText(c.text) : c.text,
      }));

      const ssml = buildSsml({ chunks: processedChunks, speeds });
      console.log(`[GoogleTTS] SSML length=${ssml.length}`);

      const payload = {
        input: { ssml },
        voice: { languageCode: 'vi-VN', name: voices.vi },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          sampleRateHertz: 24000,
          speakingRate: speeds.vi,
        },
      };

      console.log(`[GoogleTTS] calling API...`);
      const res = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        console.error(`[GoogleTTS] API error ${res.status}: ${err}`);
        throw new Error(`Google TTS error ${res.status}: ${err}`);
      }

      console.log(`[GoogleTTS] API response OK (${res.status})`);

      const json = (await res.json()) as { audioContent?: string };

      if (!json.audioContent) {
        throw new Error('Google TTS returned no audio content');
      }

      const raw = Buffer.from(json.audioContent, 'base64');
      const pcm = stripWavHeader(new Uint8Array(raw));
      console.log(`[GoogleTTS] got ${pcm.length} bytes PCM, yielding frames...`);

      for (let i = 0; i < pcm.length; i += FRAME_SIZE) {
        const end = Math.min(i + FRAME_SIZE, pcm.length);
        const frame = new Int16Array(pcm.buffer, pcm.byteOffset + i, (end - i) / 2);
        yield new Int16Array(frame);
      }

      console.log(`[GoogleTTS] done — yielded ${Math.ceil(pcm.length / FRAME_SIZE)} frames`);
    },
  };
}

function stripWavHeader(wav: Uint8Array): Uint8Array {
  if (wav[0] === 0x52 && wav[1] === 0x49 && wav[2] === 0x46 && wav[3] === 0x46) {
    let offset = 12;
    while (offset + 8 <= wav.length) {
      const chunkId = String.fromCharCode(...wav.slice(offset, offset + 4));
      const chunkSize = new DataView(wav.buffer, wav.byteOffset + offset + 4, 4).getUint32(0, true);
      if (chunkId === 'data') {
        return wav.slice(offset + 8, offset + 8 + chunkSize);
      }
      offset += 8 + chunkSize;
    }
  }
  return wav;
}
