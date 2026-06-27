"""Translation service with Azure Translator primary and local-model fallback."""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Optional

import requests
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, T5Tokenizer

from app.config import get_config

logger = logging.getLogger(__name__)

# Module-level singleton for local fallback
_model: Optional[AutoModelForSeq2SeqLM] = None
_tokenizer: Optional[AutoTokenizer] = None


def _download_hf_file(model_id: str, filename: str, cache_dir: str) -> str:
    os.makedirs(cache_dir, exist_ok=True)
    target = Path(cache_dir) / filename
    if target.exists() and target.stat().st_size > 0:
        return str(target)

    url = f"https://huggingface.co/{model_id}/resolve/main/{filename}"
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    target.write_bytes(response.content)
    return str(target)


def using_azure() -> bool:
    return get_config().azure_translate_enabled


def get_translation_backend_name() -> str:
    cfg = get_config()
    if cfg.azure_translate_enabled:
        return "azure-translator"
    return cfg.translation_model


def load_model() -> tuple[AutoModelForSeq2SeqLM, AutoTokenizer] | None:
    """Lazy-load the local translation model singleton when Azure is unavailable."""
    global _model, _tokenizer
    cfg = get_config()

    if cfg.azure_translate_enabled:
        logger.info("Azure Translator enabled; skipping local model preload")
        return None

    if _model is not None and _tokenizer is not None:
        return _model, _tokenizer

    logger.info(
        "Loading local fallback model %s on device=%s dtype=%s",
        cfg.translation_model,
        cfg.resolved_translation_device,
        cfg.translation_dtype,
    )
    os.makedirs(cfg.hf_cache_dir, exist_ok=True)

    dtype_map = {
        "float16": torch.float16,
        "bfloat16": torch.bfloat16,
        "float32": torch.float32,
    }
    torch_dtype = dtype_map.get(cfg.translation_dtype, torch.float32)

    try:
        tokenizer = AutoTokenizer.from_pretrained(
            cfg.translation_model,
            use_fast=False,
            cache_dir=cfg.hf_cache_dir,
        )
    except Exception:
        logger.warning(
            "AutoTokenizer failed for %s, retrying with T5Tokenizer",
            cfg.translation_model,
            exc_info=True,
        )
        try:
            tokenizer = T5Tokenizer.from_pretrained(
                cfg.translation_model,
                use_fast=False,
                cache_dir=cfg.hf_cache_dir,
            )
        except Exception:
            logger.warning(
                "T5Tokenizer.from_pretrained failed for %s, retrying from direct spiece.model",
                cfg.translation_model,
                exc_info=True,
            )
            spiece_path = _download_hf_file(
                cfg.translation_model,
                "spiece.model",
                os.path.join(cfg.hf_cache_dir, "manual"),
            )
            tokenizer = T5Tokenizer(
                vocab_file=spiece_path,
                extra_ids=48,
                eos_token="</s>",
                unk_token="<unk>",
                pad_token="<pad>",
            )

    model = AutoModelForSeq2SeqLM.from_pretrained(
        cfg.translation_model,
        torch_dtype=torch_dtype,
        cache_dir=cfg.hf_cache_dir,
        device_map=None,
    )
    model = model.to(cfg.resolved_translation_device)
    model.eval()

    _model = model
    _tokenizer = tokenizer
    logger.info("Local fallback model loaded successfully on device=%s", model.device)
    return model, tokenizer


def unload_model() -> None:
    """Free local fallback model from memory (for testing)."""
    global _model, _tokenizer
    _model = None
    _tokenizer = None


def is_model_loaded() -> bool:
    if using_azure():
        return True
    return _model is not None


def _format_prefix(source_lang: str, target_lang: str) -> str:
    if source_lang == "auto":
        source_lang = "vi"
    return f"{source_lang}: "


def _strip_prefix(text: str, source_lang: str, target_lang: str) -> str:
    prefixes = [f"{target_lang}: ", f"{source_lang}: "]
    for prefix in prefixes:
        if text.startswith(prefix):
            return text[len(prefix):].strip()
    return text.strip()


def _normalize_lang(value: str) -> str:
    value = (value or "").strip().lower()
    if value in {"vi", "vi-vn"}:
        return "vi"
    if value in {"en", "en-us", "en-gb"}:
        return "en"
    if value == "auto":
        return "auto"
    return value


def _translate_via_azure(text: str, source_lang: str, target_lang: str) -> str:
    cfg = get_config()
    endpoint = cfg.azure_translator_endpoint.rstrip("/")
    params: dict[str, str | list[str]] = {
      "api-version": cfg.azure_translator_api_version,
      "to": [target_lang],
    }
    normalized_source = _normalize_lang(source_lang)
    if normalized_source != "auto":
        params["from"] = normalized_source

    response = requests.post(
        f"{endpoint}/translate",
        params=params,
        headers={
            "Ocp-Apim-Subscription-Key": cfg.azure_translator_key,
            "Ocp-Apim-Subscription-Region": cfg.azure_translator_region,
            "Content-Type": "application/json",
        },
        json=[{"text": text}],
        timeout=cfg.translate_timeout,
    )
    response.raise_for_status()
    payload = response.json()
    if not payload or not isinstance(payload, list):
        raise RuntimeError("Azure Translator returned an empty response.")

    translations = payload[0].get("translations") if isinstance(payload[0], dict) else None
    if not translations or not isinstance(translations, list):
        raise RuntimeError("Azure Translator response did not include translations.")

    translated_text = translations[0].get("text") if isinstance(translations[0], dict) else None
    if not translated_text:
        raise RuntimeError("Azure Translator response did not include translated text.")

    return str(translated_text)


def _translate_via_local_model(text: str, source_lang: str, target_lang: str) -> str:
    loaded = load_model()
    if loaded is None:
        raise RuntimeError("Local model is unavailable while Azure Translator is disabled.")

    model, tokenizer = loaded
    prefix = _format_prefix(source_lang, target_lang)
    input_text = f"{prefix}{text}"

    inputs = tokenizer(input_text, return_tensors="pt", truncation=True, max_length=512)
    inputs = {k: v.to(model.device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            num_beams=1,
            do_sample=False,
            max_new_tokens=128,
            repetition_penalty=1.2,
        )

    raw_output = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return _strip_prefix(raw_output, source_lang, target_lang)


async def translate(text: str, source_lang: str, target_lang: str) -> tuple[str, float]:
    """Translate text from source_lang to target_lang.

    Returns (translated_text, latency_ms).
    """
    start = time.monotonic()
    cfg = get_config()
    normalized_source = _normalize_lang(source_lang)
    normalized_target = _normalize_lang(target_lang)

    if cfg.azure_translate_enabled:
        translated = _translate_via_azure(text, normalized_source, normalized_target)
        elapsed_ms = (time.monotonic() - start) * 1000
        logger.debug(
            "Azure translated %d chars in %.0fms: %s -> %s",
            len(text),
            elapsed_ms,
            normalized_source,
            normalized_target,
        )
        return translated, elapsed_ms

    translated = _translate_via_local_model(text, normalized_source, normalized_target)
    elapsed_ms = (time.monotonic() - start) * 1000
    logger.debug(
        "Local translated %d chars in %.0fms: %s -> %s",
        len(text),
        elapsed_ms,
        normalized_source,
        normalized_target,
    )
    return translated, elapsed_ms
