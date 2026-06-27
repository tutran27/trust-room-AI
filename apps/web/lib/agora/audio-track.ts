/**
 * Agora audio track creation with best-in-class noise suppression.
 *
 * STRATEGY
 * ────────
 * - Always enable Agora built-in AEC (Acoustic Echo Cancellation), ANS
 *   (Automatic Noise Suppression) and AGC (Automatic Gain Control) via the
 *   microphone track constraints.
 * - If the AI Denoiser extension is available (WASM / SIMD), layer it on top
 *   for even better suppression.
 * - On failure at any point the caller still gets a functional audio track
 *   with at least the built-in processing.
 *
 * USAGE
 *     import { createMicrophoneAudioTrack } from '@/lib/agora/audio-track';
 *     const track = await createMicrophoneAudioTrack();
 *     // Use with Agora RTC client:
 *     await client.publish([track]);
 *
 * CLEANUP
 *     track.stop();
 *     track.close();
 */

import AgoraRTC, { IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { createAIDenoiser, DenoiseProcessor } from './noise-suppression';

export interface AudioTrackResult {
  /** The Agora microphone audio track, ready to be published. */
  track: IMicrophoneAudioTrack;
  /** The optional AI denoiser processor. Null when not available. */
  denoiser: DenoiseProcessor | null;
  /**
   * Cleanup function – call when leaving the room.
   * Stops the track and closes the denoiser processor.
   */
  leave(): void;
}

/**
 * Create a local microphone audio track with the strongest available noise
 * suppression pipeline.
 */
export async function createMicrophoneAudioTrack(): Promise<AudioTrackResult> {
  // Step 1: Create the track with built-in AEC, ANS, AGC enabled.
  // Use `speech_high_quality` for better STT input quality (48 kHz, higher bitrate).
  const track = await AgoraRTC.createMicrophoneAudioTrack({
    AEC: true,
    ANS: true,
    AGC: true,
    encoderConfig: {
      bitrate: 64,
      sampleRate: 48000,
      stereo: false,
    },
    // Additional advanced noise suppression for consistent STT results
    AECHighSuppression: true,
    AGCLevel: 3,
  });

  // Step 2: Try to layer the AI denoiser on top.
  let denoiser: DenoiseProcessor | null = null;
  try {
    denoiser = await createAIDenoiser();
    if (denoiser) {
      // Inject the denoiser processor into the track's pipeline.
      // The exact API depends on the `agora-extension-ai-denoiser` version.
      // Most versions expose a `processor` which gets passed to
      // `track.pipe(processor).pipe(track.processorDestination)`.
      const p = denoiser.processor as any;
      if (p && typeof p === 'object' && typeof track.pipe === 'function') {
        if (typeof p.setMode === 'function') {
          try {
            p.setMode('aggressive');
          } catch {}
        }
        if (typeof p.setLevel === 'function') {
          try {
            p.setLevel(3);
          } catch {}
        }
        track.pipe(p).pipe(track.processorDestination);
        denoiser.setEnabled(true);
        console.log('[AgoraAudio] AI denoiser layered onto microphone track');
      }
    }
  } catch (err) {
    console.warn('[AgoraAudio] Could not attach AI denoiser – using built-in only', err);
    // denoiser is already null
  }

  return {
    track,
    denoiser,
    leave() {
      try {
        denoiser?.close();
      } catch {
        // ignore
      }
      try {
        track.stop();
        track.close();
      } catch {
        // ignore
      }
    },
  };
}
