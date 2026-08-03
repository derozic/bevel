"""Channel YAML workflows — store + simple message_posted engine."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bevel_api.db.models.workflow import ChannelWorkflow, WorkflowRun

# Known fleet agents for mention validation (soft)
KNOWN_AGENTS = frozenset(
    {
        "hermes",
        "johnny",
        "brain",
        "loom",
        "northstar",
        "lego",
        "tegan",
        "continuous",
        "terry",
        "forge",
    }
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _id(prefix: str = "wf") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def to_api_dict(row: ChannelWorkflow) -> dict[str, Any]:
    return {
        "id": row.id,
        "tenantId": row.tenant_id,
        "channelId": row.channel_id,
        "name": row.name,
        "enabled": row.enabled,
        "definition": dict(row.definition or {}),
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


def run_to_api_dict(row: WorkflowRun) -> dict[str, Any]:
    return {
        "id": row.id,
        "tenantId": row.tenant_id,
        "workflowId": row.workflow_id,
        "channelId": row.channel_id,
        "status": row.status,
        "triggerKind": row.trigger_kind,
        "triggerMessageId": row.trigger_message_id,
        "trace": list(row.trace or []),
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "finishedAt": row.finished_at.isoformat() if row.finished_at else None,
    }


def normalize_definition(raw: dict[str, Any]) -> dict[str, Any]:
    """Accept YAML-shaped dict; normalize to internal shape."""
    name = str(raw.get("name") or "workflow").strip()[:128]
    trigger = raw.get("trigger") if isinstance(raw.get("trigger"), dict) else {}
    on = str(trigger.get("on") or trigger.get("event") or "message_posted").strip()
    filt = trigger.get("filter") or trigger.get("contains") or ""
    steps_in = raw.get("steps") if isinstance(raw.get("steps"), list) else []
    steps: list[dict[str, Any]] = []
    for i, step in enumerate(steps_in):
        if not isinstance(step, dict):
            continue
        action = str(step.get("action") or step.get("type") or "").strip()
        if not action:
            continue
        steps.append(
            {
                "id": str(step.get("id") or f"step_{i}"),
                "action": action,
                "agent": str(step.get("agent") or step.get("agentId") or "").lower() or None,
                "text": step.get("text") or step.get("body") or step.get("message"),
                "from": step.get("from"),
                "if": step.get("if"),
            }
        )
    return {
        "name": name,
        "trigger": {"on": on, "filter": str(filt) if filt is not None else ""},
        "steps": steps,
    }


def _filter_matches(filt: str, text: str) -> bool:
    """Simple filters: empty=always; contains:X; contains(text,'X'); raw substring."""
    f = (filt or "").strip()
    if not f:
        return True
    body = text or ""
    # contains:needle
    if f.lower().startswith("contains:"):
        return f.split(":", 1)[1].strip().lower() in body.lower()
    # contains(text, 'needle') or str_contains(trigger_text, 'needle')
    m = re.search(
        r"(?:str_)?contains\s*\(\s*(?:text|trigger_text|trigger\.text)\s*,\s*['\"](.+?)['\"]\s*\)",
        f,
        re.I,
    )
    if m:
        return m.group(1).lower() in body.lower()
    # bare substring
    return f.lower() in body.lower()


async def list_for_channel(
    session: AsyncSession,
    *,
    channel_id: str,
    enabled_only: bool = False,
) -> list[ChannelWorkflow]:
    q = select(ChannelWorkflow).where(ChannelWorkflow.channel_id == channel_id)
    if enabled_only:
        q = q.where(ChannelWorkflow.enabled.is_(True))
    q = q.order_by(ChannelWorkflow.name)
    result = await session.execute(q)
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, workflow_id: str) -> ChannelWorkflow | None:
    return await session.get(ChannelWorkflow, workflow_id)


async def upsert(
    session: AsyncSession,
    *,
    tenant_id: str,
    channel_id: str,
    name: str,
    definition: dict[str, Any],
    enabled: bool = True,
    workflow_id: str | None = None,
) -> ChannelWorkflow:
    norm = normalize_definition(definition if "trigger" in definition or "steps" in definition else {
        "name": name,
        **definition,
    })
    key = (name or norm["name"]).strip()[:128]
    if workflow_id:
        row = await session.get(ChannelWorkflow, workflow_id)
        if row and row.channel_id == channel_id:
            row.name = key
            row.enabled = enabled
            row.definition = norm
            row.updated_at = _utcnow()
            await session.flush()
            return row
    result = await session.execute(
        select(ChannelWorkflow).where(
            ChannelWorkflow.channel_id == channel_id,
            ChannelWorkflow.name == key,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.enabled = enabled
        existing.definition = norm
        existing.updated_at = _utcnow()
        await session.flush()
        return existing
    row = ChannelWorkflow(
        id=_id("cwf"),
        tenant_id=tenant_id,
        channel_id=channel_id,
        name=key,
        enabled=enabled,
        definition=norm,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    session.add(row)
    await session.flush()
    return row


async def delete_workflow(session: AsyncSession, workflow_id: str) -> bool:
    row = await session.get(ChannelWorkflow, workflow_id)
    if not row:
        return False
    await session.delete(row)
    await session.flush()
    return True


async def evaluate_message_posted(
    session: AsyncSession,
    *,
    tenant_id: str,
    channel_id: str,
    channel_slug: str,
    message_id: str,
    body: str,
    speaker_type: str,
) -> list[dict[str, Any]]:
    """
    Run enabled message_posted workflows for a channel.
    Returns list of run summaries with planned/executed actions.
    Does not recurse on workflow-authored messages (speaker_type == system/workflow).
    """
    if speaker_type in {"system", "workflow", "bot"}:
        return []

    workflows = await list_for_channel(session, channel_id=channel_id, enabled_only=True)
    results: list[dict[str, Any]] = []

    for wf in workflows:
        defn = dict(wf.definition or {})
        trigger = defn.get("trigger") if isinstance(defn.get("trigger"), dict) else {}
        on = str(trigger.get("on") or "message_posted")
        if on not in {"message_posted", "message", "chat"}:
            continue
        filt = str(trigger.get("filter") or "")
        if not _filter_matches(filt, body):
            continue

        trace: list[dict[str, Any]] = []
        actions_out: list[dict[str, Any]] = []
        steps = defn.get("steps") if isinstance(defn.get("steps"), list) else []
        for step in steps:
            if not isinstance(step, dict):
                continue
            action = str(step.get("action") or "")
            step_id = str(step.get("id") or action)
            entry: dict[str, Any] = {"stepId": step_id, "action": action, "status": "ok"}

            if action == "post_message" or action == "send_message":
                text = str(step.get("text") or "").replace("{{trigger.text}}", body)
                entry["text"] = text
                actions_out.append({"type": "post_message", "body": text})
            elif action == "mention_agent":
                agent = str(step.get("agent") or "").lower()
                entry["agent"] = agent
                text = str(step.get("text") or f"@{agent} please handle: {body[:200]}")
                text = text.replace("{{trigger.text}}", body)
                if agent and f"@{agent}" not in text.lower():
                    text = f"@{agent} {text}"
                actions_out.append({"type": "mention_agent", "agentId": agent, "body": text})
            elif action == "request_approval":
                entry["status"] = "pending_approval"
                entry["from"] = step.get("from")
                entry["message"] = step.get("text") or step.get("message")
                actions_out.append(
                    {
                        "type": "request_approval",
                        "from": step.get("from"),
                        "message": step.get("text") or step.get("message") or "Approval required",
                    }
                )
            else:
                entry["status"] = "skipped"
                entry["reason"] = f"unknown action {action}"

            trace.append(entry)

        status = "completed"
        if any(a.get("type") == "request_approval" for a in actions_out):
            status = "waiting_approval"

        run = WorkflowRun(
            id=_id("wfr"),
            tenant_id=tenant_id,
            workflow_id=wf.id,
            channel_id=channel_id,
            status=status,
            trigger_kind="message_posted",
            trigger_message_id=message_id,
            trace=trace,
            created_at=_utcnow(),
            finished_at=_utcnow() if status == "completed" else None,
        )
        session.add(run)
        await session.flush()

        results.append(
            {
                "run": run_to_api_dict(run),
                "workflow": to_api_dict(wf),
                "actions": actions_out,
                "channelSlug": channel_slug,
            }
        )

    return results
