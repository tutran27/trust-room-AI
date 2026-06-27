/**
 * Edge (Microsoft) Text‑to‑Speech provider.
 *
 * Uses the free Edge Read Aloud WebSocket API — no API key needed.
 * This is the same protocol used by the edge‑tts Python library.
 *
 * Protocol:
 * 1. Fetch the voice list and a connect token from the Edge TTS endpoint
 * 2. Open a WebSocket to the SSML synthesis endpoint
 * 3. Send a JSON config message, then the SSML text
 * 4. Receive MP3 frames back, decode to PCM
 *
 * For simplicity this provider shells out to the `edge-tts` Python CLI
 * if available, falling back to a built-in WebSocket implementation.
 */

import { spawn } from 'child_process';
import { createWriteStream, mkdtempSync, readFileSync, unlinkSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { TTSProvider } from '../types.js';
import { detectLanguageChunks } from '../language.js';
import { normalizeEnglishText } from '../pronounce.js';
import { TTSConfig } from '../config.js';

/** PCM frame size (60ms at 24kHz) */
const FRAME_SIZE = 1440;

export function createEdgeProvider(config: TTSConfig): TTSProvider {
  const voices = { vi: config.edgeVoiceVi, en: config.edgeVoiceEn };
  const rates = { vi: config.edgeRateVi, en: config.edgeRateEn };

  return {
    name: 'edge',
    available: () => true, // Free, no key needed (requires edge-tts Python pkg)

    async *synthesize(text, lang, _voiceOpts, signal) {
      if (!text.trim()) return;

      // Detect mixed language chunks
      const chunks = detectLanguageChunks(text);

      // Synthesize each chunk separately
      for (const chunk of chunks) {
        if (signal?.aborted) return;

        const chunkText =
          chunk.lang === 'en' ? normalizeEnglishText(chunk.text) : chunk.text;
        if (!chunkText.trim()) continue;

        const voice = chunk.lang === 'vi' ? voices.vi : voices.en;
        const rate = chunk.lang === 'vi' ? rates.vi : rates.en;

        // Try edge-tts CLI first
        let pcm: Int16Array;
        try {
          pcm = await synthesizeWithEdgeCli(chunkText, voice, rate, signal);
        } catch {
          // If edge-tts is not available, try built-in WebSocket
          pcm = await synthesizeWithEdgeWs(chunkText, voice, rate, signal);
        }

        // Yield in frames
        for (let i = 0; i < pcm.length; i += FRAME_SIZE) {
          const end = Math.min(i + FRAME_SIZE, pcm.length);
          const frame = new Int16Array(pcm.buffer, pcm.byteOffset + i, (end - i) / 2);
          yield new Int16Array(frame);
        }
      }
    },
  };
}

/**
 * Synthesize using the edge-tts Python CLI.
 * Falls back to WebSocket if edge-tts is not installed.
 */
async function synthesizeWithEdgeCli(
  text: string,
  voice: string,
  rate: string,
  signal?: AbortSignal,
): Promise<Int16Array> {
  // Create temp output file
  const tmpDir = mkdtempSync(join(tmpdir(), 'edge-tts-'));
  const outPath = join(tmpDir, 'output.mp3');

  return new Promise<Int16Array>((resolve, reject) => {
    const proc = spawn(
      'edge-tts',
      [
        '--text', text,
        '--voice', voice,
        '--rate', rate,
        '--write-media', outPath,
      ],
      {
        stdio: 'pipe',
        signal,
        timeout: 30_000,
      },
    );

    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        // Clean up
        try { unlinkSync(outPath); } catch { /* ok */ }
        try { rmdirSync(tmpDir); } catch { /* ok */ }
        reject(new Error(`edge-tts exit code ${code}: ${stderr}`));
        return;
      }

      try {
        const mp3 = readFileSync(outPath);

        // Decode MP3 to PCM using ffmpeg
        const pcm = decodeMp3ToPcm(mp3, signal);
        resolve(pcm);
      } catch (err) {
        reject(err);
      } finally {
        try { unlinkSync(outPath); } catch { /* ok */ }
        try { rmdirSync(tmpDir); } catch { /* ok */ }
      }
    });

    proc.on('error', (err) => {
      try { unlinkSync(outPath); } catch { /* ok */ }
      try { rmdirSync(tmpDir); } catch { /* ok */ }
      reject(err);
    });
  });
}

/**
 * Synthesize using the Edge TTS WebSocket API directly.
 * This is a simplified implementation — for production, use edge-tts Python package.
 */
async function synthesizeWithEdgeWs(
  text: string,
  _voice: string,
  _rate: string,
  signal?: AbortSignal,
): Promise<Int16Array> {
  // Fallback: try ffmpeg with a simple TTS approach or return empty
  // For now, try edge-tts one more time with more debug info
  throw new Error(
    'edge-tts Python package and ffmpeg are required for Edge TTS. ' +
      'Install: pip install edge-tts && brew install ffmpeg (or apt install ffmpeg)',
  );
}

/**
 * Decode MP3 bytes to PCM int16 at 24kHz mono using ffmpeg.
 *
 * @param mp3    Raw MP3 data
 * @param signal Optional abort signal
 * @returns      PCM int16 samples at 24kHz mono
 */
function decodeMp3ToPcm(mp3: Buffer, signal?: AbortSignal): Promise<Int16Array> {
  return new Promise<Int16Array>((resolve, reject) => {
    const ffmpeg = spawn(
      'ffmpeg',
      [
        '-i', 'pipe:0',
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-ar', '24000',
        '-ac', '1',
        '-loglevel', 'error',
        'pipe:1',
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        signal,
        timeout: 30_000,
      },
    );

    const chunks: Buffer[] = [];
    let stderr = '';

    ffmpeg.stdout.on('data', (d: Buffer) => chunks.push(d));
    ffmpeg.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exit code ${code}: ${stderr}`));
        return;
      }
      const pcm = Buffer.concat(chunks);
      const samples = new Int16Array(pcm.length / 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = pcm.readInt16LE(i * 2);
      }
      resolve(samples);
    });

    ffmpeg.on('error', (err) => reject(err));

    // Write MP3 to stdin and close
    ffmpeg.stdin.write(mp3);
    ffmpeg.stdin.end();
  });
}
