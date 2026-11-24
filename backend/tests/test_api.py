"""Backend tests."""
import asyncio
import base64
import json
import uuid
from typing import AsyncGenerator

import numpy as np
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.database import Base, get_db
from app.services.speech_service import WhisperTranscriptionService
from app.main import app

# Mock Whisper model loading in test environment to avoid downloading 1.5GB weights
WhisperTranscriptionService.get_model = classmethod(lambda cls, settings=None: None)

# ─── Test database (SQLite in-memory via aiosqlite) ──────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    bind=test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


# ─── CRUD tests ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_transcription(client: AsyncClient):
    payload = {
        "title": "Test Hindi-English",
        "transcript": "आज मुझे Python में एक नया project बनाना है।",
        "language": "hi",
        "duration_seconds": 5.3,
    }
    resp = await client.post("/api/transcriptions", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == payload["title"]
    assert data["language"] == "hi"
    assert "id" in data
    return data["id"]


@pytest.mark.asyncio
async def test_list_transcriptions(client: AsyncClient):
    resp = await client.get("/api/transcriptions")
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body


@pytest.mark.asyncio
async def test_search_transcriptions(client: AsyncClient):
    resp = await client.get("/api/transcriptions?search=Python")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["items"], list)


@pytest.mark.asyncio
async def test_get_transcription_not_found(client: AsyncClient):
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/transcriptions/{fake_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_transcription(client: AsyncClient):
    # Create first
    create_resp = await client.post(
        "/api/transcriptions",
        json={"title": "Original", "transcript": "Hello", "duration_seconds": 1.0},
    )
    tid = create_resp.json()["id"]

    update_resp = await client.put(
        f"/api/transcriptions/{tid}", json={"title": "Updated Title"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Updated Title"


@pytest.mark.asyncio
async def test_delete_transcription(client: AsyncClient):
    create_resp = await client.post(
        "/api/transcriptions",
        json={"title": "To Delete", "transcript": "bye", "duration_seconds": 0.5},
    )
    tid = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/transcriptions/{tid}")
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/transcriptions/{tid}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_dashboard_stats(client: AsyncClient):
    resp = await client.get("/api/transcriptions/stats")
    assert resp.status_code == 200
    body = resp.json()
    assert "total_transcriptions" in body
    assert "total_duration_seconds" in body


# ─── Audio validation tests ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_empty_audio_validation():
    """Empty audio buffer should produce no segments."""
    from app.services.speech_service import AudioBuffer
    buf = AudioBuffer(sample_rate=16000, max_seconds=30)
    audio = buf.get_audio()
    assert len(audio) == 0


@pytest.mark.asyncio
async def test_pcm_to_float32():
    """PCM bytes conversion should produce correct float32 array."""
    from app.services.speech_service import WhisperTranscriptionService
    svc = WhisperTranscriptionService()
    # 1 second of silence (16-bit PCM, 16000 samples)
    silence = np.zeros(16000, dtype=np.int16).tobytes()
    result = svc.pcm_bytes_to_float32(silence)
    assert result.dtype == np.float32
    assert len(result) == 16000
    assert result.max() == 0.0


@pytest.mark.asyncio
async def test_deduplication():
    """merge_and_deduplicate should strip overlapping words."""
    from app.services.speech_service import WhisperTranscriptionService, TranscriptionSegment
    svc = WhisperTranscriptionService()
    confirmed = "Hello world this is"
    new_segs = [TranscriptionSegment("this is a test", 0.0, 2.0)]
    _, addition = svc.merge_and_deduplicate(confirmed, new_segs)
    assert addition == "a test"


# ─── WebSocket test ───────────────────────────────────────────────────────────

def test_websocket_connection():
    """WebSocket should accept and respond with connected message."""
    from fastapi.testclient import TestClient

    with TestClient(app) as test_client:
        with test_client.websocket_connect("/ws/transcribe") as ws:
            msg = json.loads(ws.receive_text())
            assert msg["type"] == "connected"

            ws.send_text(json.dumps({"type": "ping"}))
            pong = json.loads(ws.receive_text())
            assert pong["type"] == "pong"

            # Send stop
            ws.send_text(json.dumps({"type": "stop"}))
            final = json.loads(ws.receive_text())
            assert final["type"] == "final"
