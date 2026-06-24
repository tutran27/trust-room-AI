/**
 * Agora AI Denoise extension loader and helpers.
 *
 * This module provides a thin wrapper around the `agora-extension-ai-denoiser`
 * package which ships a Neural Network based noise suppression processor backed
 * by WebAssembly.
 *
 * FALLBACK STRATEGY
 * ─────────────────
 * 1. Try to load the AI denoiser extension and create a processor.
 * 2. If the browser does not support the required WASM / SIMD features, or the
 *    WASM assets cannot be loaded, return `null` so the caller falls back to
 *    the built-in Agora ANS that is already enabled via `AEC / ANS / AGC`
 *    constraints on the microphone track.
 *
 * PREREQUISITES
 * ──────────────
 * - Copy the `external/` directory from the `agora-extension-ai-denoiser`
 *   package into `public/vendor/agora/denoiser/external/` at build time.
 *   See AGORA_DENOISE_INTEGRATION_PLAN.md for details.
 * - The package `agora-extension-ai-denoiser` must be installed:
 *   `pnpm add -w agora-extension-ai-denoiser`
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* The agora-extension-ai-denoiser types use `any` for processor piping internals. */

let extensionInstance: any = null;
let extensionLoadAttempted = false;

export interface DenoiseProcessor {
  readonly processor: any;
  readonly enabled: boolean;
  setEnabled(on: boolean): void;
  close(): void;
}

/**
 * Attempt to load the AI denoiser extension (singleton).
 *
 * Returns `true` when the extension is available, `false` otherwise.
 * The extension is lazily loaded on first call.
 */
async function ensureExtensionLoaded(): Promise<boolean> {
  if (extensionLoadAttempted) {
    return extensionInstance !== null;
  }
  extensionLoadAttempted = true;

  // Guard: WebAssembly required
  if (typeof WebAssembly === 'undefined') {
    console.warn('[AgoraDenoise] WebAssembly not supported – falling back to built-in ANS');
    return false;
  }

  try {
    // Dynamic import so the app still loads even when the WASM assets are
    // missing or the package is not installed.
    const mod = await import('agora-extension-ai-denoiser');
    const DenoiserExt = (mod as any).AIDenoiserExtension ?? (mod as any).default ?? (mod as any);

    extensionInstance = new DenoiserExt({
      assetsPath: '/vendor/agora/denoiser/external',
    });

    return true;
  } catch (err) {
    console.warn('[AgoraDenoise] Failed to load AI denoiser extension – falling back to built-in ANS', err);
    return false;
  }
}

/**
 * Create an AI denoiser processor that can be piped through an audio track.
 *
 * Returns `null` when:
 * - The extension could not be loaded.
 * - Processor creation fails.
 *
 * Usage with Agora SDK:
 * ```ts
 * const denoise = await createAIDenoiser();
 * if (denoise) {
 *   const processor = denoise.processor; // AudioProcessor
 *   localAudioTrack.pipe(processor).pipe(localAudioTrack);
 *   // To disable: localAudioTrack.unpipe(processor);
 * }
 * ```
 */
export async function createAIDenoiser(): Promise<DenoiseProcessor | null> {
  const loaded = await ensureExtensionLoaded();
  if (!loaded || !extensionInstance) {
    return null;
  }

  try {
    const processor = extensionInstance.createProcessor();
    return wrapProcessor(processor);
  } catch (err) {
    console.warn('[AgoraDenoise] Failed to create processor – falling back to built-in ANS', err);
    return null;
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface RawProcessor {
  /** Enable the processor. */
  enable(): void;
  /** Disable the processor. */
  disable(): void;
  /** Destroy and release resources. */
  destroy(): void;
}

function wrapProcessor(proc: RawProcessor): DenoiseProcessor {
  let isEnabled = false;

  return {
    processor: proc,
    get enabled() {
      return isEnabled;
    },
    setEnabled(on: boolean) {
      try {
        if (on) {
          proc.enable();
          isEnabled = true;
        } else {
          proc.disable();
          isEnabled = false;
        }
      } catch {
        // Silently swallow – processor may be in an invalid state after
        // overload or browser event. The caller can still publish audio.
        console.warn('[AgoraDenoise] Could not toggle denoiser, falling back');
      }
    },
    close() {
      try {
        proc.disable();
        proc.destroy();
        isEnabled = false;
      } catch {
        // ignore
      }
    },
  };
}