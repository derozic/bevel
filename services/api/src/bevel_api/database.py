"""Async SQLAlchemy 2.0 database layer for the BEVEL control plane.

Postgres only (asyncpg). No SQLite fallbacks.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# Local default for dev; production must set DATABASE_URL.
DEFAULT_DATABASE_URL = "postgresql+asyncpg://bevel:bevel@127.0.0.1:5432/bevel"


def get_database_url() -> str:
    """Resolve DATABASE_URL (asyncpg scheme required for SQLAlchemy async)."""
    url = (
        os.getenv("DATABASE_URL")
        or os.getenv("BEVEL_DATABASE_URL")
        or DEFAULT_DATABASE_URL
    ).strip()
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


class Database:
    """Application database handle with FastAPI lifespan connect/disconnect."""

    def __init__(self) -> None:
        self._engine: Optional[AsyncEngine] = None
        self._session_factory: Optional[async_sessionmaker[AsyncSession]] = None

    @property
    def is_connected(self) -> bool:
        return self._engine is not None

    def get_engine(self) -> AsyncEngine:
        if self._engine is None:
            raise RuntimeError(
                "Database is not connected. Call await database.connect() first."
            )
        return self._engine

    def get_session_factory(self) -> async_sessionmaker[AsyncSession]:
        if self._session_factory is None:
            raise RuntimeError(
                "Database is not connected. Call await database.connect() first."
            )
        return self._session_factory

    async def connect(self) -> None:
        if self._engine is not None:
            return
        self._engine = create_async_engine(
            get_database_url(),
            pool_pre_ping=True,
            echo=os.getenv("SQL_ECHO", "").lower() in {"1", "true", "yes"},
        )
        self._session_factory = async_sessionmaker(
            self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

    async def disconnect(self) -> None:
        if self._engine is None:
            return
        await self._engine.dispose()
        self._engine = None
        self._session_factory = None


database = Database()


def get_engine() -> AsyncEngine:
    return database.get_engine()


@asynccontextmanager
async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield an AsyncSession; commits on success, rolls back on error."""
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
