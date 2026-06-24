#!/usr/bin/env node
/**
 * TTS Demo — test the speech-to-speech pipeline.
 *
 * Run with: pnpm --filter @trustroom/tts tsx src/demo.ts
 *
 * Usage:
 *   NODE_ENV=development tsx src/demo.ts "Hello, tôi là AI assistant" --mode edge
 *   tsx src/demo.ts --text-file text.txt --mode google
 */

import { speak, synthesizeToBuffer, loadConfig, DEFAULT_CONFIG } from './index.js';

const DEFAULT_TEXT = 'Xin chào, tôi là AI assistant của TrustRoom. Hôm nay chúng ta bàn về API design cho WebSocket server nhé?';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const textIndex = args.findIndex(a => !a.startsWith('--'));
  const text = textIndex >= 0 ? (args[textIndex] ?? DEFAULT_TEXT) : DEFAULT_TEXT;
  const modeFlag = args.find(a => a.startsWith('--mode='));
  const mode = modeFlag ? modeFlag.split('=')[1] ?? 'edge' : 'edge';

  console.log(`\n🔊 TTS Demo — mode: ${mode}`);
  console.log(`📝 Text: "${text.slice(0, 80)}..."\n`);

  const config = loadConfig({
    TTS_PROVIDER: mode,
    GOOGLE_TTS_API_KEY: process.env.GOOGLE_TTS_API_KEY ?? '',
  } as Record<string, string | undefined>);

  // Merge with defaults for non-env fields
  config.edgeVoiceVi = DEFAULT_CONFIG.edgeVoiceVi;
  config.edgeVoiceEn = DEFAULT_CONFIG.edgeVoiceEn;

  // Test 1: Preview mode — collect to buffer
  console.log('⏳ Synthesizing to buffer...');
  const pcm = await synthesizeToBuffer(text, config);
  if (pcm) {
    const durationSec = pcm.length / 24000;
    console.log(`✅ Done — ${pcm.length} samples (${durationSec.toFixed(1)}s at 24kHz)`);
  } else {
    console.log('❌ No audio returned (provider unavailable?)');
  }

  // Test 2: Streaming mode with callbacks
  console.log('\n⏳ Streaming mode (speak)...');
  let frameCount = 0;
  const startTime = Date.now();

  await speak(text, {
    config,
    onSentence: (sentence: string, lang: string) => {
      console.log(`  📢 [${lang}] ${sentence}`);
    },
    onAudio: (_pcm: Int16Array, _seq: number) => {
      frameCount++;
    },
    onDone: () => {
      const elapsed = Date.now() - startTime;
      console.log(`✅ Streaming done — ${frameCount} frames in ${elapsed}ms`);
    },
  });

  console.log('\n🏁 TTS Demo complete.\n');
}

main().catch((err: unknown) => {
  console.error('❌ Demo failed:', err);
  process.exit(1);
});
