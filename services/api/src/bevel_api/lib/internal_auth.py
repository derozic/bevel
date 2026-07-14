"""Shared internal auth for operator / agent control-plane routes."""

from __future__ import annotations

import os

from fastapi import Header, HTTPException, Request


def _client_host(request: Request) -> str:
    return request.client.host if request.client else ""


def resolve_internal_key(
    request: Request,
    x_fleet_internal_key: str | None = None,
) -> str | None:
    if x_fleet_internal_key:
        return x_fleet_internal_key
    return (
        request.headers.get("x-fleet-internal-key")
        or request.headers.get("X-Fleet-Internal-Key")
    )


def internal_ok(
    request: Request,
    x_fleet_internal_key: str | None = None,
) -> bool:
    """True when the caller may perform privileged API writes.

    Accepts:
    - X-Fleet-Internal-Key matching FLEET_INTERNAL_API_KEY
    - Loopback clients when no key is configured (local dev)
    - Loopback clients in non-production even when a key is set (agent programs)
    """
    provided = resolve_internal_key(request, x_fleet_internal_key)
    key = os.getenv("FLEET_INTERNAL_API_KEY")
    if key and provided == key:
        return True
    client = _client_host(request)
    loopback = client in {"127.0.0.1", "::1", "localhost"}
    env = os.getenv("BEVEL_ENV") or os.getenv("NODE_ENV") or "development"
    if env != "production" and loopback:
        return True
    if not key and loopback:
        return True
    return False


def enforce_internal(
    request: Request,
    x_fleet_internal_key: str | None = None,
) -> None:
    """Raise 401 when the caller is not authorized (safe for plain calls)."""
    if not internal_ok(request, x_fleet_internal_key):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized — provide X-Fleet-Internal-Key",
        )


def require_internal(
    request: Request,
    x_fleet_internal_key: str | None = Header(
        default=None,
        alias="X-Fleet-Internal-Key",
    ),
) -> None:
    """FastAPI dependency for privileged routes."""
    enforce_internal(request, x_fleet_internal_key)
