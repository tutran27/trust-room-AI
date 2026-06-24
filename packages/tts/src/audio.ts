/**
 * Audio post‑processing — loudness chain for meeting clarity.
 *
 * Applies: pre‑gain → compressor → soft clip → makeup gain → safety trim.
 *
 * The output is PCM int16 at 24 kHz mono, ready for the queue consumer.
 */

import type { LoudnessParams } from './types';

const S24 = 32768; // 2^15 (max int16 amplitude)

/**
 * Process raw PCM samples through the full loudness chain.
 *
 * @param samples - Input PCM int16 samples
 * @param params  - Loudness configuration
 * @returns       Processed PCM int16 samples
 */
export function processLoudnessChain(
  samples: Int16Array,
  params: LoudnessParams,
): Int16Array {
  if (samples.length === 0) return samples;

  // Step 1: Compute pre‑gain
  const preRms = computeRms(samples);
  let gain = 1.0;

  if (preRms > 0) {
    const targetDb = 20 * Math.log10(params.targetRms / S24);
    const preDb = 20 * Math.log10(preRms / S24);
    let boostDb = targetDb - preDb;
    boostDb = Math.min(boostDb, params.maxBoostDb);
    boostDb = Math.max(boostDb, 0); // never attenuate
    gain = 10 ** (boostDb / 20);
  }

  // Step 2: Apply pre‑gain + compressor + soft clip in a single pass
  const threshold = params.compressorThreshold * S24;
  const ratio = params.compressorRatio;
  const drive = params.softclipDrive;

  const output = new Int16Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    let sample = samples[i]! * gain;

    // Compressor: if sample exceeds threshold, reduce with ratio
    const absSample = Math.abs(sample);
    if (absSample > threshold) {
      const excess = absSample - threshold;
      const reduced = excess / ratio;
      sample = Math.sign(sample) * (threshold + reduced);
    }

    // Soft clip: tanh gives smooth saturation
    const normalized = sample / S24;
    const clipped = Math.tanh(normalized * drive);
    sample = clipped * S24;

    output[i] = clampSample(sample);
  }

  // Step 3: Makeup gain — bring average closer to target RMS
  const outputRms = computeRms(output);
  if (outputRms > 0 && outputRms < params.targetRms) {
    const makeupGain = params.targetRms / outputRms;
    // Soft makeup gain (never go above 1.6×)
    const clampedMakeup = Math.min(makeupGain, 1.6);
    for (let i = 0; i < output.length; i++) {
      output[i] = clampSample(output[i]! * clampedMakeup);
    }
  }

  // Step 4: Safety trim — if any peak exceeds maxPeak, scale down uniformly
  let peak = 0;
  for (let i = 0; i < output.length; i++) {
    const abs = Math.abs(output[i]!);
    if (abs > peak) peak = abs;
  }
  if (peak > params.maxPeak) {
    const safetyScale = params.maxPeak / peak;
    for (let i = 0; i < output.length; i++) {
      output[i] = clampSample(output[i]! * safetyScale);
    }
  }

  return output;
}

/** Compute RMS of int16 samples */
function computeRms(samples: Int16Array): number {
  if (samples.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    sumSq += s * s;
  }
  return Math.sqrt(sumSq / samples.length);
}

/** Clamp sample to valid int16 range */
function clampSample(value: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(value)));
}
