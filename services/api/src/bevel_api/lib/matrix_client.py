"""Matrix Client-Server helpers for the BEVEL appservice dual-write path."""

from __future__ import annotations

import logging
import os
import re
from typing import Any
from urllib.parse import quote

import httpx

log = logging.getLogger("bevel_api.matrix")

_LOCALPART_RE = re.compile(r"[^a-z0-9._=-]+")


def matrix_enabled() -> bool:
    flag = (os.getenv("MATRIX_ENABLED") or "").strip().lower()
    if flag in ("0", "false", "no", "off"):
        return False
    if flag in ("1", "true", "yes", "on"):
        return True
    # Enabled when AS token is configured
    return bool((os.getenv("MATRIX_AS_TOKEN") or "").strip())


def homeserver_url() -> str:
    return (
        os.getenv("MATRIX_HOMESERVER_URL") or "http://127.0.0.1:8008"
    ).rstrip("/")


def server_name() -> str:
    return (os.getenv("MATRIX_SERVER_NAME") or "matrix.bevel.is").strip()


def as_token() -> str:
    return (os.getenv("MATRIX_AS_TOKEN") or "").strip()


def hs_token() -> str:
    return (os.getenv("MATRIX_HS_TOKEN") or "").strip()


def bot_localpart() -> str:
    return (os.getenv("MATRIX_BOT_LOCALPART") or "bevel_bridge").strip().lower()


def bot_mxid() -> str:
    return f"@{bot_localpart()}:{server_name()}"


def sanitize_localpart(raw: str) -> str:
    s = raw.strip().lower().replace("@", "_at_").replace(" ", "_")
    s = _LOCALPART_RE.sub("_", s)
    s = s.strip("._-") or "user"
    return s[:64]


def agent_mxid(tenant_slug: str, agent_id: str) -> str:
    """Canonical agent Matrix id: @agent_{tenant}_{agent}:server."""
    local = sanitize_localpart(f"agent_{tenant_slug}_{agent_id}")
    return f"@{local}:{server_name()}"


def user_mxid(local_id: str) -> str:
    local = sanitize_localpart(local_id)
    return f"@{local}:{server_name()}"


def channel_alias(tenant_slug: str, channel_slug: str) -> str:
    """#tenant_channel:server — alias for BEVEL #channel."""
    local = sanitize_localpart(f"{tenant_slug}_{channel_slug}")
    return f"#{local}:{server_name()}"


class MatrixClient:
    """Minimal AS-authenticated CS API client."""

    def __init__(
        self,
        *,
        base_url: str | None = None,
        token: str | None = None,
        timeout: float = 15.0,
    ) -> None:
        self.base_url = (base_url or homeserver_url()).rstrip("/")
        self.token = token if token is not None else as_token()
        self.timeout = timeout

    @property
    def configured(self) -> bool:
        return bool(self.token and self.base_url)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    async def request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
    ) -> dict[str, Any] | None:
        if not self.configured:
            log.debug("matrix client not configured; skip %s %s", method, path)
            return None
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.request(
                    method,
                    url,
                    headers=self._headers(),
                    json=json,
                    params=params,
                )
                if res.status_code >= 400:
                    log.warning(
                        "matrix %s %s -> %s %s",
                        method,
                        path,
                        res.status_code,
                        res.text[:300],
                    )
                    return None
                if not res.content:
                    return {}
                return res.json()
        except Exception:
            log.exception("matrix request failed %s %s", method, path)
            return None

    async def ensure_registered(self, localpart: str) -> bool:
        """Register AS user if missing (shared secret / AS namespace)."""
        body = {
            "type": "m.login.application_service",
            "username": localpart,
        }
        data = await self.request("POST", "/_matrix/client/v3/register", json=body)
        return data is not None

    async def create_room(
        self,
        *,
        alias_localpart: str,
        name: str,
        topic: str = "",
        invite: list[str] | None = None,
        is_direct: bool = False,
    ) -> str | None:
        # Always private: channel aliases are guessable (#tenant_channel:server).
        # public_chat would let any HS-local user join other tenants' rooms.
        body: dict[str, Any] = {
            "name": name,
            "topic": topic or name,
            "preset": "private_chat",
            "is_direct": is_direct,
            "room_alias_name": alias_localpart,
            "creation_content": {"m.federate": False},
            "initial_state": [
                {
                    "type": "m.room.history_visibility",
                    "content": {"history_visibility": "shared"},
                }
            ],
        }
        if invite:
            body["invite"] = invite
        data = await self.request("POST", "/_matrix/client/v3/createRoom", json=body)
        if not data:
            return None
        return str(data.get("room_id") or "") or None

    async def send_text(
        self,
        room_id: str,
        body: str,
        *,
        txn_id: str,
        sender: str | None = None,
    ) -> str | None:
        """Send m.room.message; optional user_id query for AS puppeting."""
        path = (
            f"/_matrix/client/v3/rooms/{quote(room_id, safe='')}"
            f"/send/m.room.message/{quote(txn_id, safe='')}"
        )
        params = {"user_id": sender} if sender else None
        data = await self.request(
            "PUT",
            path,
            json={"msgtype": "m.text", "body": body},
            params=params,
        )
        if not data:
            return None
        return str(data.get("event_id") or "") or None

    async def join(self, room_id_or_alias: str) -> bool:
        path = f"/_matrix/client/v3/join/{quote(room_id_or_alias, safe='')}"
        data = await self.request("POST", path, json={})
        return data is not None
