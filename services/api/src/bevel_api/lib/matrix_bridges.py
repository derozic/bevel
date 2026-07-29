"""Phase 3 — bridge appservice interfaces (Slack / iMessage / SMS → Matrix)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.lib.matrix_dual_write import publish_message_to_matrix

log = logging.getLogger("bevel_api.matrix.bridges")


@dataclass
class BridgeMessage:
    tenant_id: str
    tenant_slug: str
    channel_slug: str
    body: str
    speaker_id: str
    speaker_name: str
    source: str  # slack | imessage | sms
    external_id: str = ""


class MatrixBridge(Protocol):
    kind: str

    async def publish(
        self, session: AsyncSession, msg: BridgeMessage
    ) -> str | None: ...


class BevelMatrixBridge:
    """Default bridge: map external payloads into BEVEL dual-write."""

    kind = "bevel"

    async def publish(
        self, session: AsyncSession, msg: BridgeMessage
    ) -> str | None:
        return await publish_message_to_matrix(
            session,
            tenant_id=msg.tenant_id,
            tenant_slug=msg.tenant_slug,
            channel_slug=msg.channel_slug,
            message={
                "id": f"msg_{msg.source}_{msg.external_id or 'x'}"[:64],
                "body": msg.body,
                "speakerId": msg.speaker_id,
                "speakerName": msg.speaker_name,
                "speakerType": "human",
                "status": "final",
                "source": msg.source,
            },
        )


class SlackMatrixBridge(BevelMatrixBridge):
    kind = "slack"


class IMessageMatrixBridge(BevelMatrixBridge):
    kind = "imessage"


class SmsMatrixBridge(BevelMatrixBridge):
    kind = "sms"


_REGISTRY: dict[str, MatrixBridge] = {
    "bevel": BevelMatrixBridge(),
    "slack": SlackMatrixBridge(),
    "imessage": IMessageMatrixBridge(),
    "sms": SmsMatrixBridge(),
}


def get_bridge(kind: str) -> MatrixBridge | None:
    return _REGISTRY.get(kind)


async def bridge_to_matrix(
    session: AsyncSession,
    *,
    kind: str,
    msg: BridgeMessage,
) -> str | None:
    bridge = get_bridge(kind)
    if not bridge:
        log.warning("unknown matrix bridge kind=%s", kind)
        return None
    try:
        return await bridge.publish(session, msg)
    except Exception:
        log.exception("matrix bridge %s failed", kind)
        return None


def bridge_registry_status() -> list[dict[str, Any]]:
    return [
        {"kind": k, "enabled": True, "appserviceId": f"bevel-{k}" if k != "bevel" else "bevel"}
        for k in _REGISTRY
    ]
