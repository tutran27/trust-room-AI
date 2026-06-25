"""Pydantic schemas for request/response models."""
from __future__ import annotations

from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    source_lang: str = Field("auto", pattern=r"^(auto|vi|en)$")
    target_lang: str = Field(..., pattern=r"^(vi|en)$")


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    language: str = Field(..., pattern=r"^(vi|en)$")
    speed: float = Field(1.0, ge=0.5, le=2.0)


class SpeechTranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    source_lang: str = Field("auto", pattern=r"^(auto|vi|en)$")
    target_lang: str = Field(..., pattern=r"^(vi|en)$")
    tts: bool = Field(True)
    tts_speed: float = Field(1.0, ge=0.5, le=2.0)


class TranslateResponse(BaseModel):
    translated_text: str
    source_lang: str
    target_lang: str
    latency_ms: float


class TTSResponse(BaseModel):
    audio_base64: str | None = None
    audio_url: str | None = None
    audio_format: str | None = None
    provider: str
    latency_ms: float


class SpeechTranslateResponse(BaseModel):
    translated_text: str
    source_lang: str
    target_lang: str
    audio_base64: str | None = None
    audio_url: str | None = None
    audio_format: str | None = None
    tts_provider: str | None = None
    tts_latency_ms: float | None = None
    translation_latency_ms: float
    total_latency_ms: float


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None


class HealthResponse(BaseModel):
    status: str = "ok"
    model: str | None = None
    device: str | None = None
    model_loaded: bool = False
