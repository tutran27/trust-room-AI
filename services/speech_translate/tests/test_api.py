"""Tests for the speech translation FastAPI service."""
from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "model" in data
    assert "device" in data
    assert "model_loaded" in data


@pytest.mark.asyncio
async def test_translate_vi_to_en(client: AsyncClient):
    resp = await client.post("/translate", json={
        "text": "Xin chào, tôi là một kỹ sư phần mềm.",
        "source_lang": "vi",
        "target_lang": "en",
    })
    # May 503 if model not loaded, but should at least validate
    assert resp.status_code in (200, 503)
    if resp.status_code == 200:
        data = resp.json()
        assert "translated_text" in data
        assert data["source_lang"] == "vi"
        assert data["target_lang"] == "en"
        assert data["latency_ms"] >= 0


@pytest.mark.asyncio
async def test_translate_en_to_vi(client: AsyncClient):
    resp = await client.post("/translate", json={
        "text": "Hello, I am a software engineer.",
        "source_lang": "en",
        "target_lang": "vi",
    })
    assert resp.status_code in (200, 503)
    if resp.status_code == 200:
        data = resp.json()
        assert "translated_text" in data
        assert data["source_lang"] == "en"
        assert data["target_lang"] == "vi"


@pytest.mark.asyncio
async def test_translate_empty_text(client: AsyncClient):
    resp = await client.post("/translate", json={
        "text": "",
        "source_lang": "en",
        "target_lang": "vi",
    })
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_translate_long_text(client: AsyncClient):
    resp = await client.post("/translate", json={
        "text": "A" * 6000,
        "source_lang": "en",
        "target_lang": "vi",
    })
    assert resp.status_code == 400
    assert "long" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_tts(client: AsyncClient):
    resp = await client.post("/tts", json={
        "text": "Hello, this is a test.",
        "language": "en",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "audio_base64" in data
    assert "provider" in data
    assert data["provider"] in ("google", "edge", "none")


@pytest.mark.asyncio
async def test_tts_empty_text(client: AsyncClient):
    resp = await client.post("/tts", json={
        "text": "",
        "language": "en",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_speech_translate(client: AsyncClient):
    resp = await client.post("/speech-translate", json={
        "text": "Xin chào thế giới.",
        "source_lang": "vi",
        "target_lang": "en",
        "tts": True,
    })
    assert resp.status_code in (200, 503)
    if resp.status_code == 200:
        data = resp.json()
        assert "translated_text" in data
        assert "audio_base64" in data or data.get("tts_provider") == "none"
        assert data["translation_latency_ms"] >= 0
        assert data["total_latency_ms"] >= 0


@pytest.mark.asyncio
async def test_speech_translate_no_tts(client: AsyncClient):
    resp = await client.post("/speech-translate", json={
        "text": "Bonjour le monde.",
        "source_lang": "en",
        "target_lang": "vi",
        "tts": False,
    })
    assert resp.status_code in (200, 503)
    if resp.status_code == 200:
        data = resp.json()
        assert data["tts_provider"] == "none"
        assert data["audio_base64"] is None


@pytest.mark.asyncio
async def test_speech_translate_empty(client: AsyncClient):
    resp = await client.post("/speech-translate", json={
        "text": "",
        "source_lang": "en",
        "target_lang": "vi",
        "tts": False,
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_speech_translate_too_long(client: AsyncClient):
    resp = await client.post("/speech-translate", json={
        "text": "X" * 6000,
        "source_lang": "en",
        "target_lang": "vi",
        "tts": False,
    })
    assert resp.status_code == 400