"""
WebSocket handler for real-time speech transcription.

Message protocol (JSON):
  Client → Server:
    { "type": "audio_chunk", "data": "<base64-encoded PCM bytes>" }
    { "type": "stop" }
    { "type": "ping" }

  Server → Client:
    { "type": "partial",   "text": "...", "confirmed": "...", "language": "..." }
    { "type": "final",     "text": "...", "confirmed": "...", "language": "...", "duration": 12.5 }
    { "type": "error",     "message": "..." }
    { "type": "pong" }
    { "type": "connected", "message": "..." }
"""
import asyncio
import base64
import json
import logging
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect

from app.services.speech_service import (
    SessionTranscriptionContext,
    get_transcription_service,
)

logger = logging.getLogger(__name__)


async def run_transcription_ws(websocket: WebSocket) -> None:
    """Main WebSocket coroutine for a single transcription session."""
    await websocket.accept()
    service = get_transcription_service()
    ctx = SessionTranscriptionContext(service)

    logger.info("WebSocket transcription session started.")

    try:
        await _send(websocket, {"type": "connected", "message": "Ready to transcribe"})

        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
            except asyncio.TimeoutError:
                await _send(websocket, {"type": "error", "message": "Session timeout"})
                break

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _send(websocket, {"type": "error", "message": "Invalid JSON message"})
                continue

            msg_type = msg.get("type", "")

            if msg_type == "ping":
                await _send(websocket, {"type": "pong"})

            elif msg_type == "audio_chunk":
                await _handle_audio_chunk(websocket, ctx, msg)

            elif msg_type == "stop":
                await _handle_stop(websocket, ctx)
                break

            else:
                await _send(websocket, {"type": "error", "message": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    except Exception as exc:
        logger.exception("Unexpected WebSocket error: %s", exc)
        try:
            await _send(websocket, {"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        ctx.reset()
        logger.info("WebSocket session cleaned up.")


async def _handle_audio_chunk(
    websocket: WebSocket,
    ctx: SessionTranscriptionContext,
    msg: dict,
) -> None:
    """Decode audio, push to buffer, send partial result if ready."""
    encoded = msg.get("data", "")
    if not encoded:
        return

    try:
        raw_bytes = base64.b64decode(encoded)
    except Exception:
        await _send(websocket, {"type": "error", "message": "Invalid base64 audio data"})
        return

    if len(raw_bytes) == 0:
        return

    # Run inference in a thread to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    segments = await loop.run_in_executor(None, ctx.push_audio, raw_bytes)

    if segments:
        full_text = " ".join(s.text for s in segments).strip()
        # Ensure confirmed text reflects latest progress
        confirmed = ctx.confirmed_text or full_text
        await _send(websocket, {
            "type": "partial",
            "text": full_text,
            "confirmed": confirmed,
            "language": ctx.detected_language or "auto",
        })


async def _handle_stop(websocket: WebSocket, ctx: SessionTranscriptionContext) -> None:
    """Finalize transcription and send final result."""
    loop = asyncio.get_event_loop()
    segments = await loop.run_in_executor(None, ctx.finalize)

    final_text = ctx.confirmed_text or " ".join(s.text for s in segments).strip()
    duration = ctx.recording_duration

    await _send(websocket, {
        "type": "final",
        "text": final_text,
        "confirmed": final_text,
        "language": ctx.detected_language or "auto",
        "duration": round(duration, 2),
    })


async def _send(websocket: WebSocket, payload: dict) -> None:
    try:
        await websocket.send_text(json.dumps(payload, ensure_ascii=False))
    except Exception as exc:
        logger.warning("Failed to send WebSocket message: %s", exc)
