"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes.transcriptions import router as transcription_router
from app.websocket.transcription_ws import run_transcription_ws

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialize database tables and pre-load Whisper model."""
    from app.db.database import create_tables
    try:
        await create_tables()
        logger.info("Database initialized.")
    except Exception as exc:
        logger.warning("Could not auto-create tables: %s", exc)

    from app.services.speech_service import WhisperTranscriptionService
    logger.info("Pre-loading Whisper model…")
    try:
        WhisperTranscriptionService.get_model(settings)
        logger.info("Whisper model ready.")
    except Exception as exc:
        logger.warning("Could not pre-load Whisper model: %s", exc)
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── REST routes ───────────────────────────────────────────────────────────────
app.include_router(transcription_router, prefix=settings.API_PREFIX)


# ─── WebSocket route ───────────────────────────────────────────────────────────
@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    await run_transcription_ws(websocket)


# ─── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
