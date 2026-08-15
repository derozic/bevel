"""Auth handoff codes — cross-host session continuity (bevel.is → org host)."""

from __future__ import annotations

import logging
import os
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.deps import get_session
from bevel_api.lib.internal_auth import internal_ok
from bevel_api.repositories import handoff as handoff_repo
from bevel_api.repositories import tenants as tenants_repo
from bevel_api.repositories import users as users_repo
from bevel_api.repositories import webhooks as hooks_repo

router = APIRouter(prefix="/v1/auth", tags=["Auth"])
log = logging.getLogger("bevel.auth")

SessionDep = Annotated[AsyncSession, Depends(get_session)]


class IssueHandoffBody(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    name: str = ""
    imageUrl: str | None = None
    tenantSlug: str = Field(..., min_length=1, max_length=64)
    callbackPath: str = "/^general"
    payloadJson: str | None = None
    ttlSeconds: int = Field(default=120, ge=30, le=600)


class RedeemHandoffBody(BaseModel):
    code: str = Field(..., min_length=8, max_length=256)


class GoogleNativeBody(BaseModel):
    """Native Google Sign-In (Flutter) → handoff code for WebView session."""

    idToken: str = Field(..., min_length=20, max_length=8192)
    tenantSlug: str = Field(default="2x4m", min_length=1, max_length=64)
    callbackPath: str = "/~general"
    accessToken: str | None = None


def _google_audiences() -> list[str]:
    """OAuth client IDs allowed as id_token audience (web + iOS + Android)."""
    raw = (
        os.getenv("GOOGLE_NATIVE_CLIENT_IDS")
        or os.getenv("AUTH_GOOGLE_ID")
        or os.getenv("GOOGLE_CLIENT_ID")
        or ""
    )
    parts: list[str] = []
    for chunk in raw.replace(";", ",").split(","):
        c = chunk.strip().strip('"').strip("'")
        if c:
            parts.append(c)
    # Common secondary clients from env
    for key in (
        "GOOGLE_IOS_CLIENT_ID",
        "GOOGLE_ANDROID_CLIENT_ID",
        "AUTH_GOOGLE_IOS_ID",
        "AUTH_GOOGLE_ANDROID_ID",
    ):
        v = (os.getenv(key) or "").strip().strip('"')
        if v and v not in parts:
            parts.append(v)
    return parts


def _verify_google_id_token(token: str) -> dict[str, Any]:
    """Verify Google ID token; returns claims or raises HTTPException."""
    audiences = _google_audiences()
    if not audiences:
        raise HTTPException(
            503,
            "Google native login not configured — set AUTH_GOOGLE_ID / GOOGLE_NATIVE_CLIENT_IDS",
        )
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token
    except ImportError as exc:
        raise HTTPException(503, "google-auth not installed") from exc

    last_err: Exception | None = None
    request = google_requests.Request()
    for aud in audiences:
        try:
            claims = google_id_token.verify_oauth2_token(token, request, audience=aud)
            # Basic integrity
            iss = str(claims.get("iss") or "")
            if iss not in {"accounts.google.com", "https://accounts.google.com"}:
                raise ValueError(f"bad iss {iss}")
            if not claims.get("email"):
                raise ValueError("email missing")
            if claims.get("email_verified") is False:
                raise ValueError("email not verified")
            return claims
        except Exception as exc:  # noqa: BLE001 — try next audience
            last_err = exc
            continue
    log.warning("google id_token verify failed: %s", last_err)
    raise HTTPException(401, "Invalid Google ID token")


@router.post("/handoff")
async def issue_handoff(
    body: IssueHandoffBody,
    request: Request,
    session: SessionDep,
) -> dict[str, Any]:
    """Issue a one-time handoff code. Requires internal key or loopback in non-prod.

    Called by Next.js after platform login before redirecting to org host.
    """
    if not internal_ok(request):
        raise HTTPException(401, "Unauthorized — provide X-Fleet-Internal-Key")

    plain, row = await handoff_repo.issue(
        session,
        email=body.email,
        name=body.name,
        image_url=body.imageUrl,
        tenant_slug=body.tenantSlug,
        callback_path=body.callbackPath,
        payload_json=body.payloadJson,
        ttl_seconds=body.ttlSeconds,
    )
    user, created = await users_repo.upsert_identity(
        session,
        email=body.email,
        name=body.name,
        image_url=body.imageUrl,
    )
    if created:
        await _emit_ftue(session, user, tenant_slug=body.tenantSlug)
    return {
        "ok": True,
        "code": plain,
        "expiresAt": row.expires_at.isoformat(),
        "tenantSlug": row.tenant_slug,
        "callbackPath": row.callback_path,
    }


@router.post("/handoff/redeem")
async def redeem_handoff(
    body: RedeemHandoffBody,
    session: SessionDep,
) -> dict[str, Any]:
    """Redeem a handoff code. Public but one-time + short-lived."""
    payload = await handoff_repo.redeem(session, body.code)
    if payload is None:
        raise HTTPException(400, "Invalid or expired handoff code")
    user, created = await users_repo.upsert_identity(
        session,
        email=payload["email"],
        name=payload.get("name") or "",
        image_url=payload.get("imageUrl"),
    )
    if created:
        await _emit_ftue(session, user, tenant_slug=payload.get("tenantSlug"))
    return {"ok": True, **payload}


@router.post("/google-native")
async def google_native_login(
    body: GoogleNativeBody,
    session: SessionDep,
) -> dict[str, Any]:
    """Exchange a native Google Sign-In ID token for a handoff code.

    Flutter uses the Google Sign-In SDK (in-app account picker — not Safari),
    then redeems the returned code in the WebView via /api/auth/handoff so
    Auth.js cookies land in the WebView jar.
    """
    claims = _verify_google_id_token(body.idToken.strip())
    email = str(claims["email"]).strip().lower()
    name = str(claims.get("name") or claims.get("given_name") or email.split("@")[0])
    image = claims.get("picture")
    image_url = str(image) if image else None

    path = body.callbackPath.strip() or "/~general"
    if not path.startswith("/") or path.startswith("//"):
        path = "/~general"
    tenant = (body.tenantSlug or "2x4m").strip().lower() or "2x4m"

    plain, row = await handoff_repo.issue(
        session,
        email=email,
        name=name,
        image_url=image_url,
        tenant_slug=tenant,
        callback_path=path,
        ttl_seconds=180,
    )
    user, created = await users_repo.upsert_identity(
        session,
        email=email,
        name=name,
        image_url=image_url,
        tenant_id=None,
    )
    if created:
        await _emit_ftue(session, user, tenant_slug=tenant)
    return {
        "ok": True,
        "code": plain,
        "expiresAt": row.expires_at.isoformat(),
        "email": email,
        "name": name,
        "imageUrl": image_url,
        "userId": getattr(user, "id", None) or email,
        "tenantSlug": tenant,
        "callbackPath": path,
    }


async def _emit_ftue(session: AsyncSession, user: Any, *, tenant_slug: str | None) -> None:
    slug = (tenant_slug or "2x4m").strip().lower() or "2x4m"
    tenant = await tenants_repo.get_by_slug(session, slug)
    if tenant is None:
        return
    actor = {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "handle": user.handle,
    }
    data = {**actor, "personalAgentId": user.personal_agent_id or "hermes"}
    try:
        await hooks_repo.emit(
            session,
            tenant_id=tenant.id,
            tenant_slug=tenant.slug,
            event="user.created",
            data=data,
            actor=actor,
        )
        await hooks_repo.emit(
            session,
            tenant_id=tenant.id,
            tenant_slug=tenant.slug,
            event="ftue.started",
            data=data,
            conversation=f"dm-{str(user.id).replace('/', '_')}-hermes",
            actor=actor,
        )
    except Exception:
        log.exception("ftue webhook emit failed")
