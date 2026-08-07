"""Firebase Cloud Messaging (HTTP v1) fan-out for native push.

Tokens live in Postgres (`push_tokens`). Sends use a service account JSON
from env:

  FIREBASE_SERVICE_ACCOUNT_JSON   raw JSON string
  FIREBASE_SERVICE_ACCOUNT_PATH   path to JSON file
  FIREBASE_PROJECT_ID             optional override (else taken from JSON)

When unset, send helpers no-op with ok=false / skipped reason so message
writes never fail.
"""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any

import httpx

log = logging.getLogger("bevel.fcm")

_SCOPES = ("https://www.googleapis.com/auth/firebase.messaging",)
_token_cache: dict[str, Any] = {"access_token": None, "expires_at": 0.0, "project_id": None}


def fcm_configured() -> bool:
    return bool(_service_account_info())


def _service_account_info() -> dict[str, Any] | None:
    raw = (os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or "").strip()
    if raw:
        try:
            data = json.loads(raw)
            if isinstance(data, dict) and data.get("private_key"):
                return data
        except json.JSONDecodeError:
            log.warning("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON")
            return None
    path = (os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH") or "").strip()
    if path:
        p = Path(path)
        if p.is_file():
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                if isinstance(data, dict) and data.get("private_key"):
                    return data
            except (OSError, json.JSONDecodeError) as exc:
                log.warning("FIREBASE_SERVICE_ACCOUNT_PATH unreadable: %s", exc)
    return None


def _project_id(info: dict[str, Any]) -> str:
    env = (os.getenv("FIREBASE_PROJECT_ID") or "").strip()
    if env:
        return env
    return str(info.get("project_id") or "").strip()


def _access_token(info: dict[str, Any]) -> str | None:
    now = time.time()
    cached = _token_cache.get("access_token")
    exp = float(_token_cache.get("expires_at") or 0)
    if cached and now < exp - 60:
        return str(cached)
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
    except ImportError:
        log.warning("google-auth not installed — cannot mint FCM access token")
        return None
    try:
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=_SCOPES
        )
        creds.refresh(Request())
        _token_cache["access_token"] = creds.token
        _token_cache["expires_at"] = now + 3500
        _token_cache["project_id"] = _project_id(info)
        return creds.token
    except Exception as exc:
        log.warning("FCM token mint failed: %s", exc)
        return None


async def send_to_token(
    *,
    token: str,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
    high_priority: bool = False,
    android_channel: str = "bevel_workspace",
) -> dict[str, Any]:
    """Send one FCM message. Never raises."""
    info = _service_account_info()
    if not info:
        return {"ok": False, "skipped": True, "reason": "fcm_not_configured"}
    project = _project_id(info)
    if not project:
        return {"ok": False, "skipped": True, "reason": "missing_project_id"}
    access = _access_token(info)
    if not access:
        return {"ok": False, "error": "token_mint_failed"}

    payload_data = {k: str(v) for k, v in (data or {}).items()}
    # Always include deep-link friendly fields for the Flutter client
    if "payload" not in payload_data and payload_data.get("deepLink"):
        payload_data["payload"] = payload_data["deepLink"]

    message: dict[str, Any] = {
        "token": token,
        "notification": {
            "title": title[:200],
            "body": body[:1000],
        },
        "data": payload_data,
        "android": {
            "priority": "HIGH" if high_priority else "NORMAL",
            "notification": {
                "channel_id": android_channel,
                "sound": "default",
            },
        },
        "apns": {
            "headers": {
                "apns-priority": "10" if high_priority else "5",
                "apns-push-type": "alert",
            },
            "payload": {
                "aps": {
                    "alert": {"title": title[:200], "body": body[:1000]},
                    "sound": "default",
                    "interruption-level": "time-sensitive"
                    if high_priority
                    else "active",
                }
            },
        },
    }

    url = f"https://fcm.googleapis.com/v1/projects/{project}/messages:send"
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {access}",
                    "Content-Type": "application/json",
                },
                json={"message": message},
            )
        if res.status_code >= 200 and res.status_code < 300:
            return {"ok": True, "status": res.status_code, "body": res.json()}
        # Stale / unregistered token
        text = res.text[:500]
        invalid = res.status_code in {404, 400} and (
            "UNREGISTERED" in text
            or "NOT_FOUND" in text
            or "invalid" in text.lower()
        )
        return {
            "ok": False,
            "status": res.status_code,
            "error": text,
            "invalid_token": invalid,
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def send_to_user_tokens(
    session: Any,
    *,
    user_id: str,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
    high_priority: bool = False,
    android_channel: str = "bevel_workspace",
    email: str | None = None,
) -> dict[str, Any]:
    """Look up Postgres tokens for user and fan out. Best-effort.

    Matches tokens by ``user_id`` and optionally by email (native clients often
    register with the session email before a stable fleet user id is known).
    """
    if not user_id and not email:
        return {"ok": False, "skipped": True, "reason": "no_user"}
    if not fcm_configured():
        return {"ok": False, "skipped": True, "reason": "fcm_not_configured"}

    from bevel_api.repositories import push_tokens as push_tokens_repo

    tokens = []
    seen: set[str] = set()
    for key in (user_id, email or ""):
        k = (key or "").strip()
        if not k:
            continue
        for row in await push_tokens_repo.list_for_user(session, user_id=k):
            if row.token in seen:
                continue
            seen.add(row.token)
            tokens.append(row)
    if not tokens:
        return {"ok": True, "sent": 0, "tokens": 0}

    results: list[dict[str, Any]] = []
    sent = 0
    for row in tokens:
        r = await send_to_token(
            token=row.token,
            title=title,
            body=body,
            data=data,
            high_priority=high_priority,
            android_channel=android_channel,
        )
        results.append({"tokenId": row.id, "platform": row.platform, **r})
        if r.get("ok"):
            sent += 1
        elif r.get("invalid_token"):
            try:
                await push_tokens_repo.unregister(session, row.token)
            except Exception:
                pass

    return {"ok": True, "sent": sent, "tokens": len(tokens), "results": results}
