"""
FinGuard 2026 — PostgreSQL Connection & Session Management.

Async SQLAlchemy connection pool for user data, audit logs,
and decision records.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config.logging_config import get_logger
from config.settings import get_settings

logger = get_logger(__name__)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all ORM models."""
    pass


# ─── Sync Engine (for migrations & scripts) ────────────────────────────────

_sync_engine = None
_sync_session_factory = None


def get_sync_engine():
    global _sync_engine
    if _sync_engine is None:
        settings = get_settings()
        url = settings.database.database_url
        _sync_engine = create_engine(url, echo=False, pool_pre_ping=True)
    return _sync_engine


def get_sync_session() -> Session:
    global _sync_session_factory
    if _sync_session_factory is None:
        _sync_session_factory = sessionmaker(bind=get_sync_engine())
    return _sync_session_factory()


# ─── Async Engine (for API serving) ────────────────────────────────────────

_async_engine = None
_async_session_factory = None


def get_async_engine():
    global _async_engine
    if _async_engine is None:
        settings = get_settings()
        url = settings.database.database_url
        # Convert sqlite:/// to sqlite+aiosqlite:///
        if url.startswith("sqlite:///"):
            url = url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        _async_engine = create_async_engine(url, echo=False, pool_pre_ping=True)
    return _async_engine


def get_async_session_factory() -> async_sessionmaker[AsyncSession]:
    global _async_session_factory
    if _async_session_factory is None:
        _async_session_factory = async_sessionmaker(
            bind=get_async_engine(), class_=AsyncSession, expire_on_commit=False
        )
    return _async_session_factory


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency injection: yield an async DB session."""
    factory = get_async_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def init_db() -> None:
    """Create all tables (for development/testing)."""
    engine = get_sync_engine()
    Base.metadata.create_all(bind=engine)
    logger.info("database_initialized")
