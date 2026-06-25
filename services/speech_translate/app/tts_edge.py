"""Edge TTS fallback using edge-tts library."""
from __future__ import annotations

import io
import logging
import time
from typing import Optional

from app.config import get_config

logger = logging.getLogger(__name__)


def _get_edge_voice(language: str) -> str:
    """Get configured Edge TTS voice for language."""
    cfg = get_config()
    if language == "vi":
        return cfg.edge_tts_voice_vi
    return cfg.edge_tts_voice_en


async def synthesize_speech(text: str, language: str, speed: Optional[float] = None) -> tuple[Optional[bytes], float]:
    """Synthesize speech using Edge TTS.

    Returns (audio_bytes_or_None, latency_ms).
    Used as fallback when Google TTS fails.
    """
    start = time.monotonic()

    cfg = get_config()
    if not cfg.edge_tts_enabled:
        logger.debug("Edge TTS is disabled via config")
        return None, (time.monotonic() - start) * 1000

    try:
        import edge_tts  # type: ignore

        voice = _get_edge_voice(language)

        # Build rate string from speed multiplier
        # edge-tts rate format: +50%, -20%, etc.
        rate_val = 0.0
        if speed is not None:
            rate_val = (speed - 1.0) * 100
        rate_str = f"{rate_val:+.0f}%"

        communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate_str)
        audio_data = bytearray()

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data.extend(chunk["data"])

        elapsed_ms = (time.monotonic() - start) * 1000
        logger.debug("Edge TTS synthesized %d chars in %.0fms", len(text), elapsed_ms)

        return bytes(audio_data), elapsed_ms

    except ImportError:
        logger.warning("edge-tts package not installed, cannot use Edge TTS fallback")
        return None, (time.monotonic() - start) * 1000
    except Exception as exc:
        elapsed_ms = (time.monotonic() - start) * 1000
        logger.warning("Edge TTS failed after %.0fms: %s", elapsed_ms, exc)
        return None, elapsed_ms