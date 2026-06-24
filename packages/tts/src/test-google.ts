/**
 * QUICK TEST: Google TTS trực tiếp, không qua NestJS.
 * Run: GOOGLE_TTS_API_KEY=<your-key> npx tsx packages/tts/src/test-google.ts
 */
import { createGoogleProvider } from './providers/google-tts.js';
import { loadConfig, DEFAULT_CONFIG } from './config.js';
import { writeFileSync } from 'fs';

const key = process.env.GOOGLE_TTS_API_KEY ?? '';
console.log('Key length:', key.length);
console.log('Key prefix:', key.slice(0, 15) + '...');

const config = loadConfig({
  TTS_PROVIDER: 'google',
  GOOGLE_TTS_API_KEY: key,
} as any);

const provider = createGoogleProvider(config);
console.log('Provider available:', provider.available());

if (!provider.available()) {
  console.error('❌ Google TTS not available');
  process.exit(1);
}

(async () => {
  try {
    console.log('\n🎯 Calling Google TTS API...');
    const start = Date.now();
    const frames: Int16Array[] = [];

    for await (const frame of provider.synthesize(
      'Xin chào, đây là giọng nói từ Google TTS. Test một hai ba bốn năm.',
      'vi',
      { voice: config.googleVoiceVi, speed: config.googleSpeedVi }
    )) {
      frames.push(frame);
    }

    const elapsed = Date.now() - start;
    const totalLen = frames.reduce((a, f) => a + f.length, 0);
    console.log(`\n✅ SUCCESS: ${totalLen} samples (${(totalLen/24000).toFixed(1)}s) in ${elapsed}ms`);

    const merged = new Int16Array(totalLen);
    let off = 0;
    for (const f of frames) { merged.set(f, off); off += f.length; }
    writeFileSync('/tmp/test-google-tts.raw', Buffer.from(merged.buffer));
    console.log('✅ File: /tmp/test-google-tts.raw');
    console.log('✅ Play: ffplay -f s16le -ar 24000 -ac 1 /tmp/test-google-tts.raw');
  } catch (err) {
    console.error('❌ FAILED:', err);
  }
})();
