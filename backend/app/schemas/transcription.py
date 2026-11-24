"""Pydantic schemas for transcription API."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ─── Request schemas ─────────────────────────────────────────────────────────

class TranscriptionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Transcription title")
    transcript: str = Field(..., description="Full transcript text")
    language: Optional[str] = Field(None, max_length=50, description="Detected language code")
    duration_seconds: float = Field(0.0, ge=0, description="Recording duration in seconds")


class TranscriptionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    transcript: Optional[str] = None
    language: Optional[str] = Field(None, max_length=50)
    duration_seconds: Optional[float] = Field(None, ge=0)


# ─── Response schemas ─────────────────────────────────────────────────────────

class TranscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    transcript: str
    language: Optional[str]
    duration_seconds: float
    created_at: datetime
    updated_at: datetime


class TranscriptionListResponse(BaseModel):
    items: list[TranscriptionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── Stats schema ─────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_transcriptions: int
    total_duration_seconds: float
    recent_transcriptions: list[TranscriptionResponse]
