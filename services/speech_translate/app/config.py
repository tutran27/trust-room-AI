"""Configuration for the speech translation service."""
from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from dotenv import load_dotenv


SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]

# Load both service-local and repo-root env files so the Python service can run
# standalone while still sharing the main project .env.
load_dotenv(SERVICE_ROOT / ".env", override=False)
load_dotenv(REPO_ROOT / ".env", override=False)


@dataclass(frozen=True)
class Config:
    """Read-only config populated from environment variables."""

    # Translation provider
    translation_provider: str = os.getenv("TRANSLATION_PROVIDER", "azure").lower()
    azure_translator_key: str = os.getenv("AZURE_TRANSLATOR_KEY", "")
    azure_translator_endpoint: str = os.getenv(
        "AZURE_TRANSLATOR_ENDPOINT",
        "https://api.cognitive.microsofttranslator.com",
    )
    azure_translator_region: str = os.getenv("AZURE_TRANSLATOR_REGION", "")
    azure_translator_api_version: str = os.getenv("AZURE_TRANSLATOR_API_VERSION", "3.0")

    # Local translation model fallback
    translation_model: str = os.getenv("TRANSLATION_MODEL", "VietAI/envit5-translation")
    translation_device: str = os.getenv("TRANSLATION_DEVICE", "auto")
    translation_dtype: str = os.getenv("TRANSLATION_DTYPE", "float32")
    preload_model: bool = os.getenv("PRELOAD_MODEL", "false").lower() == "true"
    hf_cache_dir: str = os.getenv(
        "HF_CACHE_DIR",
        str(Path(__file__).resolve().parents[1] / ".hf-cache"),
    )

    # Server
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "4100"))
    log_level: str = os.getenv("LOG_LEVEL", "info")

    # Google TTS
    google_tts_credentials_json: str = os.getenv("GOOGLE_TTS_CREDENTIALS_JSON", "")
    google_application_credentials: str = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    google_tts_api_key: str = os.getenv("GOOGLE_TTS_API_KEY", "")
    google_tts_voice_vi: str = os.getenv("GOOGLE_TTS_VOICE_VI", "vi-VN-Standard-A")
    google_tts_voice_en: str = os.getenv("GOOGLE_TTS_VOICE_EN", "en-US-Standard-C")
    google_tts_speed_vi: float = float(os.getenv("GOOGLE_TTS_SPEED_VI", "1.0"))
    google_tts_speed_en: float = float(os.getenv("GOOGLE_TTS_SPEED_EN", "1.0"))
    google_tts_audio_encoding: str = os.getenv("GOOGLE_TTS_AUDIO_ENCODING", "MP3")

    # Edge TTS fallback
    edge_tts_enabled: bool = os.getenv("EDGE_TTS_ENABLED", "false").lower() == "true"
    edge_tts_voice_vi: str = os.getenv("EDGE_TTS_VOICE_VI", "vi-VN-HoaiMyNeural")
    edge_tts_voice_en: str = os.getenv("EDGE_TTS_VOICE_EN", "en-US-JennyNeural")

    # Audio post-process
    tts_target_rms: float = float(os.getenv("TTS_TARGET_RMS", "0.05"))
    tts_max_peak: float = float(os.getenv("TTS_MAX_PEAK", "0.95"))
    tts_max_boost_db: float = float(os.getenv("TTS_MAX_BOOST_DB", "6.0"))
    tts_compressor_threshold: float = float(os.getenv("TTS_COMPRESSOR_THRESHOLD", "0.5"))
    tts_compressor_ratio: float = float(os.getenv("TTS_COMPRESSOR_RATIO", "4.0"))
    tts_softclip_drive: float = float(os.getenv("TTS_SOFTCLIP_DRIVE", "2.0"))

    # Timeouts (seconds)
    translate_timeout: float = float(os.getenv("TRANSLATE_TIMEOUT", "10"))
    tts_timeout: float = float(os.getenv("TTS_TIMEOUT", "15"))
    speech_translate_timeout: float = float(os.getenv("SPEECH_TRANSLATE_TIMEOUT", "25"))

    # Validation
    max_text_length: int = int(os.getenv("MAX_TEXT_LENGTH", "5000"))

    @property
    def resolved_translation_device(self) -> str:
        """Resolve 'auto' to cuda/cpu."""
        if self.translation_device == "auto":
            try:
                import torch
                return "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                return "cpu"
        return self.translation_device

    @property
    def azure_translate_enabled(self) -> bool:
        return bool(
            self.translation_provider == "azure"
            and self.azure_translator_key
            and self.azure_translator_endpoint
            and self.azure_translator_region
        )


_config: Optional[Config] = None


def get_config() -> Config:
    global _config
    if _config is None:
        _config = Config()
    return _config
