"""SendGrid email delivery for escalations and transactional mail.

Configured via env (1Password → systemd), never browser-side keys:

  SENDGRID_API_KEY
  SENDGRID_FROM_EMAIL   (verified sender)
  SENDGRID_FROM_NAME    (optional, default BEVEL)
  SENDGRID_ENABLED=1    (optional hard switch)

Extension pattern: tenants enable email escalations when key is present.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

log = logging.getLogger("bevel_api.sendgrid")

SENDGRID_API = "https://api.sendgrid.com/v3/mail/send"


def sendgrid_configured() -> bool:
    key = (os.getenv("SENDGRID_API_KEY") or "").strip()
    enabled = (os.getenv("SENDGRID_ENABLED") or "1").strip().lower()
    if enabled in {"0", "false", "no", "off"}:
        return False
    return bool(key)


def from_address() -> tuple[str, str]:
    email = (os.getenv("SENDGRID_FROM_EMAIL") or "noreply@bevel.is").strip()
    name = (os.getenv("SENDGRID_FROM_NAME") or "BEVEL").strip()
    return email, name


async def send_email(
    *,
    to_email: str,
    subject: str,
    html: str,
    text: str | None = None,
    categories: list[str] | None = None,
) -> dict[str, Any]:
    """Send one transactional email. Returns {ok, status|error}."""
    key = (os.getenv("SENDGRID_API_KEY") or "").strip()
    if not key:
        return {"ok": False, "error": "sendgrid_not_configured"}
    to_email = to_email.strip().lower()
    if not to_email or "@" not in to_email:
        return {"ok": False, "error": "invalid_to"}

    from_email, from_name = from_address()
    payload: dict[str, Any] = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email, "name": from_name},
        "subject": subject[:200],
        "content": [
            {"type": "text/plain", "value": text or _strip_html(html)},
            {"type": "text/html", "value": html},
        ],
    }
    if categories:
        payload["categories"] = categories[:10]

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                SENDGRID_API,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if res.status_code in {200, 201, 202}:
            return {"ok": True, "status": res.status_code}
        log.warning(
            "sendgrid_failed status=%s body=%s",
            res.status_code,
            (res.text or "")[:300],
        )
        return {
            "ok": False,
            "error": f"sendgrid_http_{res.status_code}",
            "detail": (res.text or "")[:200],
        }
    except Exception as exc:
        log.exception("sendgrid_exception")
        return {"ok": False, "error": str(exc)[:200]}


async def send_escalation_email(
    *,
    to_email: str,
    actor_label: str,
    body_preview: str,
    channel_slug: str | None,
    timeline_url: str,
    personal_agent_id: str | None = None,
) -> dict[str, Any]:
    channel = f"~{channel_slug}" if channel_slug else "a conversation"
    subject = f"Escalation from {actor_label}: {(body_preview or '')[:80]}"
    agent_line = (
        f"<p style='color:#64748b;font-size:13px'>Your personal agent "
        f"<strong>{personal_agent_id}</strong> can help close this loop.</p>"
        if personal_agent_id
        else ""
    )
    html = f"""<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#0a0e12;color:#e2e8f0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#141a21;border-radius:12px;padding:24px;border:1px solid #f59e0b55">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;color:#fbbf24;font-weight:700;text-transform:uppercase">Escalation</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#f8fafc">{actor_label} needs you</h1>
    <p style="margin:0 0 8px;color:#94a3b8;font-size:13px">In {channel}</p>
    <p style="margin:0 0 20px;line-height:1.5;color:#cbd5e1">{_escape(body_preview or "(no preview)")}</p>
    {agent_line}
    <p style="margin:24px 0 0">
      <a href="{timeline_url}" style="display:inline-block;background:#f59e0b;color:#1c1917;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px">
        Open timeline
      </a>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#64748b">
      Soft @mentions stay quiet. ^escalations notify hard (push + email).
    </p>
  </div>
</body></html>"""
    return await send_email(
        to_email=to_email,
        subject=subject,
        html=html,
        categories=["bevel", "escalation"],
    )


def _escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _strip_html(html: str) -> str:
    import re

    return re.sub(r"<[^>]+>", " ", html).strip()
