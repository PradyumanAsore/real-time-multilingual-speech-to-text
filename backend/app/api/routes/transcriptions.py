"""REST API routes for transcriptions."""
import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.transcription import (
    DashboardStats,
    TranscriptionCreate,
    TranscriptionListResponse,
    TranscriptionResponse,
    TranscriptionUpdate,
)
from app.services.transcription_service import transcription_crud

router = APIRouter(prefix="/transcriptions", tags=["Transcriptions"])


# ─── Stats / Dashboard ───────────────────────────────────────────────────────

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """Return aggregate statistics for the dashboard."""
    stats = await transcription_crud.get_stats(db)
    return stats


# ─── CRUD ────────────────────────────────────────────────────────────────────

@router.post("", response_model=TranscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_transcription(
    payload: TranscriptionCreate,
    db: AsyncSession = Depends(get_db),
):
    obj = await transcription_crud.create(db, payload)
    return obj


@router.get("", response_model=TranscriptionListResponse)
async def list_transcriptions(
    search: Optional[str] = Query(None, description="Full-text search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    items, total = await transcription_crud.list(db, search=search, page=page, page_size=page_size)
    total_pages = max(1, math.ceil(total / page_size))
    return TranscriptionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{id}", response_model=TranscriptionResponse)
async def get_transcription(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await transcription_crud.get(db, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Transcription not found")
    return obj


@router.put("/{id}", response_model=TranscriptionResponse)
async def update_transcription(
    id: uuid.UUID,
    payload: TranscriptionUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await transcription_crud.get(db, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Transcription not found")
    return await transcription_crud.update(db, obj, payload)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transcription(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    obj = await transcription_crud.get(db, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Transcription not found")
    await transcription_crud.delete(db, obj)
