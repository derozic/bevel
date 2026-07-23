"""FastAPI dependencies for the BEVEL control plane."""

from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.database import database


async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield a request-scoped session; commit on success, rollback on error."""
    if not database.is_connected:
        raise HTTPException(
            status_code=503,
            detail="Database is not connected — set DATABASE_URL and start Postgres",
        )
    factory = database.get_session_factory()
    session = factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
