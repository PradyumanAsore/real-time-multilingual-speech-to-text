"""CRUD operations for Transcription model."""
import math
import uuid
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transcription import Transcription
from app.schemas.transcription import TranscriptionCreate, TranscriptionUpdate


class TranscriptionCRUD:
    async def create(
        self, db: AsyncSession, payload: TranscriptionCreate
    ) -> Transcription:
        obj = Transcription(**payload.model_dump())
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return obj

    async def get(self, db: AsyncSession, id: uuid.UUID) -> Optional[Transcription]:
        result = await db.execute(select(Transcription).where(Transcription.id == id))
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Transcription], int]:
        query = select(Transcription)
        count_query = select(func.count()).select_from(Transcription)

        if search:
            like = f"%{search}%"
            filter_expr = or_(
                Transcription.title.ilike(like),
                Transcription.transcript.ilike(like),
            )
            query = query.where(filter_expr)
            count_query = count_query.where(filter_expr)

        total_result = await db.execute(count_query)
        total = total_result.scalar_one()

        query = (
            query.order_by(Transcription.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(query)
        items = list(result.scalars().all())
        return items, total

    async def update(
        self, db: AsyncSession, obj: Transcription, payload: TranscriptionUpdate
    ) -> Transcription:
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(obj, field, value)
        await db.commit()
        await db.refresh(obj)
        return obj

    async def delete(self, db: AsyncSession, obj: Transcription) -> None:
        await db.delete(obj)
        await db.commit()

    async def get_stats(self, db: AsyncSession) -> dict:
        total_count = await db.execute(select(func.count()).select_from(Transcription))
        total_duration = await db.execute(select(func.sum(Transcription.duration_seconds)))

        recent_result = await db.execute(
            select(Transcription)
            .order_by(Transcription.created_at.desc())
            .limit(5)
        )
        recent = list(recent_result.scalars().all())

        return {
            "total_transcriptions": total_count.scalar_one() or 0,
            "total_duration_seconds": float(total_duration.scalar_one() or 0),
            "recent_transcriptions": recent,
        }


transcription_crud = TranscriptionCRUD()
