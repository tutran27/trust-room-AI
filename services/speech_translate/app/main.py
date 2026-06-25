"""FastAPI application for speech-to-speech translation pipeline."""
from __future__ import annotations

import base64
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_config
from app.schemas import (
    HealthResponse,
    TranslateRequest,
    TranslateResponse,
    TTSRequest,
    TTSResponse,
    SpeechTranslateRequest,
    SpeechTranslateResponse,
)
from app.translator import translate, load_model, is_model_loaded
from app.tts_google import synthesize_speech as google_synthesize
from app.tts_edge import synthesize_speech as edge_synthesize
from app.audio_postprocess import postprocess_audio

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    cfg = get_config()
    logger.info(
        "Translation service starting — model=%s device=%s dtype=%s preload_model=%s",
        cfg.translation_model,
        cfg.resolved_translation_device,
        cfg.translation_dtype,
        cfg.preload_model,
    )
    if cfg.preload_model:
        logger.info("Pre-loading translation model...")
        try:
            load_model()
            logger.info("Translation model pre-loaded successfully and ready to serve.")
        except Exception:
            logger.exception("Failed to pre-load translation model!")
            raise
    else:
        logger.warning(
            "Translation model NOT pre-loaded (preload_model=false). "
            "Model will be loaded lazily on first translate request."
        )
    logger.info("Translation service ready and listening on %s:%s", cfg.host, cfg.port)
    yield


app = FastAPI(
    title="Speech Translation Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health():
    cfg = get_config()
    return HealthResponse(
        status="ok",
        model=cfg.translation_model,
        device=cfg.resolved_translation_device,
        model_loaded=is_model_loaded(),
    )


@app.post("/translate", response_model=TranslateResponse)
async def translate_text(req: TranslateRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    if len(req.text) > 5000:
        raise HTTPException(status_code=400, detail="Text too long (max 5000 chars)")

    try:
        translated, latency_ms = await translate(req.text, req.source_lang, req.target_lang)
        return TranslateResponse(
            translated_text=translated,
            source_lang=req.source_lang,
            target_lang=req.target_lang,
            latency_ms=latency_ms,
        )
    except Exception as exc:
        logger.exception("Translation failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/tts", response_model=TTSResponse)
async def tts(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    cfg = get_config()

    # Try Google TTS first
    audio_bytes, google_latency = await google_synthesize(req.text, req.language, req.speed)

    provider = "google"
    if audio_bytes is None:
        # Fallback to Edge TTS
        audio_bytes, edge_latency = await edge_synthesize(req.text, req.language, req.speed)
        provider = "edge"

    if audio_bytes is None:
        # Text-only fallback
        return TTSResponse(
            audio_base64=None,
            audio_format=None,
            provider="none",
            latency_ms=0,
        )

    # Post-process audio
    audio_bytes = postprocess_audio(audio_bytes) or audio_bytes

    audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
    audio_format = cfg.google_tts_audio_encoding.lower()

    return TTSResponse(
        audio_base64=audio_b64,
        audio_format=audio_format,
        provider=provider,
        latency_ms=google_latency,
    )


@app.post("/speech-translate", response_model=SpeechTranslateResponse)
async def speech_translate(req: SpeechTranslateRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    if len(req.text) > 5000:
        raise HTTPException(status_code=400, detail="Text too long (max 5000 chars)")

    cfg = get_config()
    total_start = time.monotonic()

    # Step 1: Translate
    try:
        translated, translate_latency = await translate(req.text, req.source_lang, req.target_lang)
    except Exception as exc:
        logger.exception("Translation failed in speech-translate")
        raise HTTPException(status_code=500, detail=f"Translation failed: {exc}")

    # Step 2: TTS (if requested)
    audio_b64 = None
    audio_format = None
    tts_provider = "none"
    tts_latency = 0.0

    if req.tts:
        audio_bytes, tts_latency = await google_synthesize(translated, req.target_lang, req.tts_speed)
        tts_provider = "google"

        if audio_bytes is None:
            audio_bytes, edge_latency = await edge_synthesize(translated, req.target_lang, req.tts_speed)
            tts_provider = "edge"
            tts_latency = edge_latency

        if audio_bytes is not None:
            audio_bytes = postprocess_audio(audio_bytes) or audio_bytes
            audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
            audio_format = cfg.google_tts_audio_encoding.lower()

    total_ms = (time.monotonic() - total_start) * 1000

    return SpeechTranslateResponse(
        translated_text=translated,
        source_lang=req.source_lang,
        target_lang=req.target_lang,
        audio_base64=audio_b64,
        audio_format=audio_format,
        tts_provider=tts_provider,
        translation_latency_ms=translate_latency,
        tts_latency_ms=tts_latency,
        total_latency_ms=total_ms,
    )