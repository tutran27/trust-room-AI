"""Translation service using VietAI/envit5-translation."""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Optional

import torch
import requests
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, T5Tokenizer

from app.config import get_config

logger = logging.getLogger(__name__)

# Module-level singleton
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

def load_model() -> tuple[AutoModelForSeq2SeqLM, AutoTokenizer]:
    """Lazy-load the translation model singleton."""
    global _model, _tokenizer
    if _model is not None and _tokenizer is not None:
        return _model, _tokenizer

    cfg = get_config()
    logger.info("Loading model %s on device=%s dtype=%s",
                cfg.translation_model, cfg.resolved_translation_device, cfg.translation_dtype)
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
    # Explicitly disable device_map to avoid requiring the accelerate
    # library.  We place the model on the target device manually with
    # ``model.to(device)`` afterwards.
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
    logger.info("Model loaded successfully on device=%s", model.device)
    return model, tokenizer


def unload_model() -> None:
    """Free model from memory (for testing)."""
    global _model, _tokenizer
    _model = None
    _tokenizer = None


def is_model_loaded() -> bool:
    return _model is not None


def _format_prefix(source_lang: str, target_lang: str) -> str:
    """Return the input prefix for envit5 translation."""
    # If source is auto, try to detect or default to vi
    if source_lang == "auto":
        # Default to vi detection: we could add language detection later
        source_lang = "vi"

    # envit5 uses format: {source_lang}: {text}
    return f"{source_lang}: "


def _strip_prefix(text: str, source_lang: str, target_lang: str) -> str:
    """Strip the output prefix like 'vi: ' or 'en: ' from translated text."""
    prefixes = [f"{target_lang}: ", f"{source_lang}: "]
    for prefix in prefixes:
        if text.startswith(prefix):
            return text[len(prefix):].strip()
    return text.strip()


async def translate(text: str, source_lang: str, target_lang: str) -> tuple[str, float]:
    """Translate text from source_lang to target_lang.

    Returns (translated_text, latency_ms).
    """
    start = time.monotonic()

    model, tokenizer = load_model()
    prefix = _format_prefix(source_lang, target_lang)
    input_text = f"{prefix}{text}"

    inputs = tokenizer(input_text, return_tensors="pt", truncation=True, max_length=512)
    # Move to same device as model
    inputs = {k: v.to(model.device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            num_beams=1,
            do_sample=False,
            max_new_tokens=128,
        )

    raw_output = tokenizer.decode(outputs[0], skip_special_tokens=True)
    translated = _strip_prefix(raw_output, source_lang, target_lang)

    elapsed_ms = (time.monotonic() - start) * 1000
    logger.debug("Translated %d chars in %.0fms: %s -> %s", len(text), elapsed_ms, source_lang, target_lang)

    return translated, elapsed_ms
