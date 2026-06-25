"""Google Cloud Text-to-Speech wrapper with server-side credentials."""
from __future__ import annotations

import base64
import json
import logging
import os
import time
from typing import Optional

from app.config import get_config

logger = logging.getLogger(__name__)

# Lazy import to avoid crashing if google lib is not installed
_tts_client = None


def _get_google_tts_client():
    """Initialize Google TTS client with server-side credentials."""
    global _tts_client
    if _tts_client is not None:
        return _tts_client

    cfg = get_config()

    # Strategy 1: GOOGLE_APPLICATION_CREDENTIALS env file path
    if cfg.google_application_credentials and os.path.exists(cfg.google_application_credentials):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cfg.google_application_credentials

    # Strategy 2: GOOGLE_TTS_CREDENTIALS_JSON inline JSON
    elif cfg.google_tts_credentials_json:
        import google.auth.transport.requests  # type: ignore
        from google.oauth2 import service_account  # type: ignore

        creds_dict = json.loads(cfg.google_tts_credentials_json)
        creds = service_account.Credentials.from_service_account_info(
            creds_dict,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        from google.cloud import texttospeech  # type: ignore
        _tts_client = texttospeech.TextToSpeechClient(credentials=creds)
        return _tts_client

    # Strategy 3: API Key fallback (limited)
    elif cfg.google_tts_api_key:
        logger.warning("Using Google TTS with API key - limited functionality")
        # API key approach requires different client initialization
        from google.cloud import texttospeech  # type: ignore
        _tts_client = texttospeech.TextToSpeechClient(
            client_options={"api_key": cfg.google_tts_api_key}
        )
        return _tts_client

    # Default: use application default credentials
    try:
        from google.cloud import texttospeech  # type: ignore
        _tts_client = texttospeech.TextToSpeechClient()
    except Exception as exc:
        logger.warning("Failed to create Google TTS client: %s", exc)
        return None

    return _tts_client


def _get_voice_name(language: str) -> str:
    """Get the configured voice name for language."""
    cfg = get_config()
    if language == "vi":
        return cfg.google_tts_voice_vi
    return cfg.google_tts_voice_en


def _get_speaking_rate(language: str) -> float:
    """Get configured speaking rate for language."""
    cfg = get_config()
    if language == "vi":
        return cfg.google_tts_speed_vi
    return cfg.google_tts_speed_en


async def synthesize_speech(text: str, language: str, speed: Optional[float] = None) -> tuple[Optional[bytes], float]:
    """Synthesize speech using Google TTS.

    Returns (audio_bytes_or_None, latency_ms).
    On failure returns (None, latency_ms) so callers can fallback.
    """
    start = time.monotonic()
    cfg = get_config()

    try:
        client = _get_google_tts_client()
        if client is None:
            logger.warning("Google TTS client not available")
            return None, (time.monotonic() - start) * 1000

        from google.cloud import texttospeech  # type: ignore

        synthesis_input = texttospeech.SynthesisInput(text=text)

        voice_name = _get_voice_name(language)
        speaking_rate = speed if speed is not None else _get_speaking_rate(language)

        # Determine language code from voice name
        lang_code = voice_name.split("-")[0] + "-" + voice_name.split("-")[1] if "-" in voice_name else "en-US"

        voice = texttospeech.VoiceSelectionParams(
            language_code=lang_code,
            name=voice_name,
        )

        encoding_map = {
            "MP3": texttospeech.AudioEncoding.MP3,
            "LINEAR16": texttospeech.AudioEncoding.LINEAR16,
            "OGG_OPUS": texttospeech.AudioEncoding.OGG_OPUS,
        }
        audio_encoding = encoding_map.get(
            cfg.google_tts_audio_encoding.upper(),
            texttospeech.AudioEncoding.MP3,
        )

        audio_config = texttospeech.AudioConfig(
            audio_encoding=audio_encoding,
            speaking_rate=speaking_rate,
        )

        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
        )

        elapsed_ms = (time.monotonic() - start) * 1000
        logger.debug("Google TTS synthesized %d chars in %.0fms", len(text), elapsed_ms)

        return response.audio_content, elapsed_ms

    except Exception as exc:
        elapsed_ms = (time.monotonic() - start) * 1000
        logger.warning("Google TTS failed after %.0fms: %s", elapsed_ms, exc)
        return None, elapsed_ms