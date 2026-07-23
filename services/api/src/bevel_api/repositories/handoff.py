"""Cross-host auth handoff codes (one-time, short-lived)."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.handoff import AuthHandoffCode

DEFAULT_TTL_SECONDS = 120


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def mint_plain_code() -> str:
    return secrets.token_urlsafe(32)


async def issue(
    session: AsyncSession,
    *,
    email: str,
    name: str = "",
    image_url: str | None = None,
    tenant_slug: str,
    callback_path: str = "/^general",
    payload_json: str | None = None,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> tuple[str, AuthHandoffCode]:
    """Create a handoff code. Returns (plaintext_code, row)."""
    plain = mint_plain_code()
    row = AuthHandoffCode(
        id=uuid.uuid4().hex,
        code_hash=hash_code(plain),
        email=email.strip().lower(),
        name=name or "",
        image_url=image_url,
        tenant_slug=tenant_slug,
        callback_path=callback_path or "/^general",
        payload_json=payload_json,
        expires_at=_utcnow() + timedelta(seconds=ttl_seconds),
        used_at=None,
        created_at=_utcnow(),
    )
    session.add(row)
    await session.flush()
    return plain, row


async def redeem(
    session: AsyncSession,
    plain_code: str,
) -> dict[str, Any] | None:
    """Consume a valid unused code. Returns payload dict or None."""
    if not plain_code or not plain_code.strip():
        return None
    digest = hash_code(plain_code.strip())
    result = await session.execute(
        select(AuthHandoffCode).where(AuthHandoffCode.code_hash == digest)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    now = _utcnow()
    if row.used_at is not None:
        return None
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now:
        return None

    row.used_at = now
    await session.flush()
    return {
        "email": row.email,
        "name": row.name,
        "imageUrl": row.image_url,
        "tenantSlug": row.tenant_slug,
        "callbackPath": row.callback_path,
        "payloadJson": row.payload_json,
    }
