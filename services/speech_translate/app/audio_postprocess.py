"""Audio post-processing: RMS normalize, peak limit, compressor, softclip."""
from __future__ import annotations

import io
import logging
import math
import struct
import wave
from typing import Optional

import numpy as np

from app.config import get_config

logger = logging.getLogger(__name__)


def _bytes_to_samples(audio_bytes: bytes) -> tuple[np.ndarray, int, int, int]:
    """Read WAV bytes and return (samples_float, sample_rate, channels, sample_width)."""
    with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
        channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        sample_rate = wf.getframerate()
        raw = wf.readframes(wf.getnframes())

    # Convert to float [-1.0, 1.0]
    if sample_width == 2:
        samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    elif sample_width == 4:
        samples = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        samples = np.frombuffer(raw, dtype=np.float32)

    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)

    return samples, sample_rate, channels, sample_width


def _samples_to_bytes(samples: np.ndarray, sample_rate: int, sample_width: int) -> bytes:
    """Write float samples to WAV bytes."""
    if sample_width == 2:
        data = np.clip(samples * 32768, -32768, 32767).astype(np.int16).tobytes()
    elif sample_width == 4:
        data = np.clip(samples * 2147483648, -2147483648, 2147483647).astype(np.int32).tobytes()
    else:
        data = samples.astype(np.float32).tobytes()

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(sample_width)
        wf.setframerate(sample_rate)
        wf.writeframes(data)
    return buf.getvalue()


def _rms_normalize(samples: np.ndarray, target_rms: float) -> np.ndarray:
    """Normalize audio to target RMS level."""
    current_rms = np.sqrt(np.mean(samples ** 2))
    if current_rms < 1e-8:
        return samples
    gain = target_rms / current_rms
    return samples * gain


def _peak_limit(samples: np.ndarray, max_peak: float) -> np.ndarray:
    """Hard peak limiter."""
    peak = np.max(np.abs(samples))
    if peak <= max_peak:
        return samples
    gain = max_peak / peak
    return samples * gain


def _compressor(samples: np.ndarray, threshold: float, ratio: float) -> np.ndarray:
    """Simple soft compressor above threshold."""
    above = np.abs(samples) > threshold
    if not np.any(above):
        return samples

    result = samples.copy()
    excess = np.abs(samples[above]) - threshold
    compressed = threshold + excess / ratio
    result[above] = np.sign(samples[above]) * compressed
    return result


def _softclip(samples: np.ndarray, drive: float) -> np.ndarray:
    """Soft clipping using tanh-based saturation."""
    return np.tanh(samples * drive) / np.tanh(drive)


def postprocess_audio(audio_bytes: bytes) -> Optional[bytes]:
    """Apply audio post-processing chain: normalize -> compressor -> softclip -> peak limit.

    Falls back to raw audio on any failure.
    """
    if not audio_bytes:
        return None

    try:
        cfg = get_config()
        samples, sample_rate, channels, sample_width = _bytes_to_samples(audio_bytes)

        # RMS normalize
        samples = _rms_normalize(samples, cfg.tts_target_rms)

        # Compressor
        samples = _compressor(samples, cfg.tts_compressor_threshold, cfg.tts_compressor_ratio)

        # Soft clip
        samples = _softclip(samples, cfg.tts_softclip_drive)

        # Peak limit (final safety)
        samples = _peak_limit(samples, cfg.tts_max_peak)

        return _samples_to_bytes(samples, sample_rate, sample_width)

    except Exception as exc:
        logger.warning("Audio post-process failed, returning raw: %s", exc)
        return audio_bytes