"""User repository — identity cache / membership / handle lookup."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.user import User

_HANDLE_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{1,62}$")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return uuid.uuid4().hex


def normalize_handle(raw: str | None) -> str | None:
    if not raw:
        return None
    h = raw.strip().lower().lstrip("@^~#")
    if not h or not _HANDLE_RE.match(h):
        return None
    return h


def to_public_dict(
    user: User,
    *,
    include_email: bool = False,
    include_agent_config: bool = False,
    include_preferences: bool = False,
) -> dict[str, Any]:
    """Directory-safe user card. Email only for the authenticated self."""
    prefs = dict(user.preferences or {})
    profile = dict(prefs.get("profile") or {})
    out: dict[str, Any] = {
        "id": user.id,
        "name": user.name,
        "imageUrl": user.image_url,
        "handle": user.handle,
        "tenantId": user.tenant_id,
        "role": user.role,
        "personalAgentId": user.personal_agent_id,
        "isActive": user.is_active,
        # Convenience mirrors from preferences.profile when present
        "displayName": profile.get("displayName") or user.name,
        "bio": profile.get("bio") or "",
        "photoUrl": profile.get("photoUrl") or user.image_url,
    }
    if include_email:
        out["email"] = user.email
    if include_agent_config:
        out["personalAgentConfig"] = dict(user.personal_agent_config or {})
    if include_preferences:
        out["preferences"] = prefs
        out["profile"] = profile
    return out


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    normalized = email.strip().lower()
    result = await session.execute(select(User).where(User.email == normalized))
    return result.scalar_one_or_none()


async def get_by_id(session: AsyncSession, user_id: str) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_by_handle(
    session: AsyncSession,
    *,
    handle: str,
    tenant_id: str | None = None,
) -> User | None:
    h = normalize_handle(handle)
    if not h:
        return None
    q = select(User).where(User.handle == h, User.is_active.is_(True))
    if tenant_id:
        q = q.where(User.tenant_id == tenant_id)
    result = await session.execute(q.limit(1))
    return result.scalar_one_or_none()


async def lookup_handles(
    session: AsyncSession,
    *,
    q: str = "",
    tenant_id: str | None = None,
    limit: int = 20,
) -> list[User]:
    lim = max(1, min(limit, 50))
    query = select(User).where(User.is_active.is_(True), User.handle.is_not(None))
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    needle = (q or "").strip().lower().lstrip("@^")
    if needle:
        like = f"%{needle}%"
        query = query.where(
            or_(
                User.handle.ilike(like),
                User.name.ilike(like),
                User.email.ilike(like),
            )
        )
    query = query.order_by(User.handle.asc()).limit(lim)
    result = await session.execute(query)
    return list(result.scalars().all())


def _deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Recursive dict merge; patch wins. Arrays and scalars replace."""
    out = dict(base)
    for key, val in patch.items():
        if (
            key in out
            and isinstance(out[key], dict)
            and isinstance(val, dict)
            and not _is_plain_record(val)
        ):
            out[key] = _deep_merge(out[key], val)
        else:
            out[key] = val
    return out


def _is_plain_record(d: dict[str, Any]) -> bool:
    """Heuristic: treat map-like records (channelMap) as replace, not merge trees."""
    # Nested preference objects we deep-merge are known; freeform maps replace.
    return False


async def get_preferences(session: AsyncSession, user_id: str) -> dict[str, Any]:
    user = await get_by_id(session, user_id)
    if not user:
        return {}
    return dict(user.preferences or {})


async def save_preferences(
    session: AsyncSession,
    *,
    user_id: str,
    preferences: dict[str, Any],
    merge: bool = True,
    tenant_id: str | None = None,
) -> User | None:
    """Persist full preferences blob and sync denormalized profile columns."""
    user = await get_by_id(session, user_id)
    if not user:
        return None

    incoming = dict(preferences or {})
    # Never accept raw provider secrets if a client ever sends them
    ai = incoming.get("ai")
    if isinstance(ai, dict):
        for k in ("apiKey", "api_key", "secret", "token"):
            ai.pop(k, None)
        providers = ai.get("providers")
        if isinstance(providers, dict):
            for _pid, state in providers.items():
                if isinstance(state, dict):
                    for k in ("apiKey", "api_key", "secret", "token"):
                        state.pop(k, None)

    if merge:
        current = dict(user.preferences or {})
        next_prefs = _deep_merge(current, incoming)
    else:
        next_prefs = incoming

    user.preferences = next_prefs

    # Sync profile denorms from preferences.profile when present
    profile = next_prefs.get("profile")
    if isinstance(profile, dict):
        display = (profile.get("displayName") or "").strip()
        if display:
            user.name = display
        photo = (profile.get("photoUrl") or "").strip()
        if photo:
            user.image_url = photo
        handle_raw = profile.get("handle")
        if handle_raw is not None:
            normalized = normalize_handle(str(handle_raw))
            if str(handle_raw).strip() and not normalized:
                raise ValueError("invalid handle — use 2–63 chars [a-z0-9_-]")
            if normalized:
                existing = await get_by_handle(
                    session,
                    handle=normalized,
                    tenant_id=user.tenant_id or tenant_id,
                )
                if existing and existing.id != user.id:
                    raise ValueError(f"handle @{normalized} is already taken")
            user.handle = normalized
        agent = (profile.get("personalAgentId") or "").strip().lower() or None
        if "personalAgentId" in profile:
            user.personal_agent_id = agent

    if tenant_id and not user.tenant_id:
        user.tenant_id = tenant_id
    user.updated_at = _utcnow()
    await session.flush()
    return user


async def update_profile(
    session: AsyncSession,
    *,
    user_id: str,
    handle: str | None = None,
    name: str | None = None,
    image_url: str | None = None,
    personal_agent_id: str | None | object = ...,
    personal_agent_config: dict[str, Any] | None = None,
    tenant_id: str | None = None,
    profile: dict[str, Any] | None = None,
    preferences: dict[str, Any] | None = None,
) -> User | None:
    user = await get_by_id(session, user_id)
    if not user:
        return None
    if handle is not None:
        normalized = normalize_handle(handle)
        if handle.strip() and not normalized:
            raise ValueError("invalid handle — use 2–63 chars [a-z0-9_-]")
        if normalized:
            # Ensure unique within tenant
            existing = await get_by_handle(
                session, handle=normalized, tenant_id=user.tenant_id or tenant_id
            )
            if existing and existing.id != user.id:
                raise ValueError(f"handle @{normalized} is already taken")
        user.handle = normalized
    if name is not None:
        user.name = name.strip() or user.name
    if image_url is not None:
        user.image_url = image_url.strip() or None
    if personal_agent_id is not ...:
        agent = (personal_agent_id or "").strip().lower() or None
        user.personal_agent_id = agent
    if personal_agent_config is not None:
        user.personal_agent_config = dict(personal_agent_config)
    if tenant_id and not user.tenant_id:
        user.tenant_id = tenant_id

    # Merge profile/preferences into JSONB SoT
    prefs = dict(user.preferences or {})
    if preferences:
        prefs = _deep_merge(prefs, dict(preferences))
    if profile:
        existing_profile = dict(prefs.get("profile") or {})
        prefs["profile"] = _deep_merge(existing_profile, dict(profile))
        # Keep denorms in sync when only profile patch is sent
        p = prefs["profile"]
        if name is None and p.get("displayName"):
            user.name = str(p["displayName"]).strip() or user.name
        if image_url is None and p.get("photoUrl"):
            user.image_url = str(p["photoUrl"]).strip() or user.image_url
        if handle is None and p.get("handle") is not None:
            nh = normalize_handle(str(p.get("handle") or ""))
            if str(p.get("handle") or "").strip() and not nh:
                raise ValueError("invalid handle — use 2–63 chars [a-z0-9_-]")
            if nh:
                existing = await get_by_handle(
                    session, handle=nh, tenant_id=user.tenant_id or tenant_id
                )
                if existing and existing.id != user.id:
                    raise ValueError(f"handle @{nh} is already taken")
            user.handle = nh
        if personal_agent_id is ... and "personalAgentId" in p:
            user.personal_agent_id = (
                str(p.get("personalAgentId") or "").strip().lower() or None
            )
    # Always reflect column-level name/handle/image into profile for consistency
    prof = dict(prefs.get("profile") or {})
    if name is not None:
        prof["displayName"] = user.name
    if handle is not None:
        prof["handle"] = user.handle or ""
    if image_url is not None:
        prof["photoUrl"] = user.image_url or ""
    if personal_agent_id is not ...:
        prof["personalAgentId"] = user.personal_agent_id or ""
    prefs["profile"] = prof
    user.preferences = prefs

    user.updated_at = _utcnow()
    await session.flush()
    return user


async def upsert_identity(
    session: AsyncSession,
    *,
    email: str,
    name: str = "",
    image_url: str | None = None,
    tenant_id: str | None = None,
    role: str = "member",
    handle: str | None = None,
) -> tuple[User, bool]:
    normalized = email.strip().lower()
    existing = await get_by_email(session, normalized)
    if existing:
        if name:
            existing.name = name
        if image_url is not None:
            existing.image_url = image_url
        if tenant_id:
            existing.tenant_id = tenant_id
        if handle and not existing.handle:
            existing.handle = normalize_handle(handle)
        existing.updated_at = _utcnow()
        await session.flush()
        return existing, False

    derived_handle = normalize_handle(handle) or normalize_handle(
        normalized.split("@")[0]
    )
    row = User(
        id=_id(),
        email=normalized,
        name=name or normalized.split("@")[0] or normalized,
        image_url=image_url,
        tenant_id=tenant_id,
        role=role,
        is_active=True,
        handle=derived_handle,
        # Hermes is the default personal agent (fleet co-founder + desktop partner).
        personal_agent_id="hermes",
        personal_agent_config={"role": "personal", "source": "default"},
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    session.add(row)
    await session.flush()
    return row, True
