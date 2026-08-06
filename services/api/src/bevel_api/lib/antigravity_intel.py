"""On-board default intelligence via Google Antigravity SDK.

Safe defaults: no shell/filesystem tools on the control plane. Structured +
chat completions only (BuiltinTools.FINISH). Workspace tool access can be
enabled later behind a dedicated capability flag / sandbox workspace.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Literal

import pydantic
from pydantic import BaseModel, Field

logger = logging.getLogger("bevel_api.antigravity")

IntelligenceMode = Literal[
    "chat",
    "summarize",
    "draft_reply",
    "channel_digest",
    "onboard",
]

DEFAULT_SYSTEM = """You are BEVEL's onboard intelligence — a clear, concise assistant
for human + agent workspaces (channels, DMs, timelines, escalations).

Rules:
- Prefer short, actionable answers.
- Use workspace context when provided; do not invent channel history.
- When drafting messages, match a professional but human tone.
- Never invent credentials, private keys, or claims about systems you cannot see.
- If context is missing, say what you need instead of guessing.
"""

ONBOARD_SYSTEM = """You are BEVEL's onboard guide for new members.

Help them:
1. Pick a handle — personal agent defaults to hermes (change anytime)
2. Understand ~channels vs @mentions vs ^escalations
3. Find Timeline, preferences, and how agents show up in chat
4. Optionally enable Agent Trace for power users

Keep replies short and step-oriented. Offer the next best action.
"""


def resolve_api_key() -> str | None:
    """GEMINI / Google key from env or common .env files."""
    for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GEMINI_API_KEY"):
        value = os.getenv(name)
        if value and value.strip() and not value.startswith("["):
            return value.strip()

    # services/api → repo root
    api_root = Path(__file__).resolve().parents[3]
    repo_root = Path(__file__).resolve().parents[4]
    for path in (
        api_root / ".env",
        repo_root / ".env",
        repo_root / ".env.local",
        repo_root / "apps" / "web" / ".env.local",
    ):
        if not path.is_file():
            continue
        try:
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, raw = line.partition("=")
                key = key.strip()
                if key not in (
                    "GEMINI_API_KEY",
                    "GOOGLE_API_KEY",
                    "GOOGLE_GEMINI_API_KEY",
                ):
                    continue
                value = raw.strip().strip('"').strip("'")
                if value and not value.startswith("["):
                    return value
        except OSError:
            continue
    return None


def is_available() -> bool:
    try:
        import google.antigravity  # noqa: F401
    except ImportError:
        return False
    return resolve_api_key() is not None


def status() -> dict[str, Any]:
    try:
        import google.antigravity as ga

        version = getattr(ga, "__version__", None) or "installed"
    except ImportError:
        return {
            "sdk": "google-antigravity",
            "installed": False,
            "configured": False,
            "defaultProvider": True,
        }
    key = resolve_api_key()
    return {
        "sdk": "google-antigravity",
        "installed": True,
        "version": version,
        "configured": bool(key),
        "keyPreview": (f"…{key[-4:]}" if key and len(key) >= 4 else None),
        "defaultProvider": True,
        "modes": [
            "chat",
            "summarize",
            "draft_reply",
            "channel_digest",
            "onboard",
        ],
    }


class IntelligenceRequest(BaseModel):
    mode: IntelligenceMode = "chat"
    prompt: str = Field(min_length=1, max_length=32_000)
    context: str | None = Field(default=None, max_length=64_000)
    tenantId: str | None = None
    roomKind: str | None = None
    roomId: str | None = None
    agentId: str = "bevel-intel"
    conversationId: str | None = None


class IntelligenceResult(BaseModel):
    ok: bool = True
    text: str
    mode: IntelligenceMode
    provider: str = "antigravity"
    model: str | None = None
    thoughts: list[str] = Field(default_factory=list)
    toolCalls: list[dict[str, Any]] = Field(default_factory=list)
    runId: str | None = None
    error: str | None = None


def _system_for_mode(mode: IntelligenceMode) -> str:
    if mode == "onboard":
        return ONBOARD_SYSTEM
    if mode == "summarize":
        return (
            DEFAULT_SYSTEM
            + "\nTask: Summarize the provided context for a busy teammate. "
            "Use short bullets; call out decisions, asks, and open loops."
        )
    if mode == "draft_reply":
        return (
            DEFAULT_SYSTEM
            + "\nTask: Draft a reply the user can send. Output only the draft "
            "message body unless they asked for options."
        )
    if mode == "channel_digest":
        return (
            DEFAULT_SYSTEM
            + "\nTask: Produce a channel digest: themes, owners, next steps, "
            "and anything that looks like a ^escalation-worthy item."
        )
    return DEFAULT_SYSTEM


def _build_prompt(req: IntelligenceRequest) -> str:
    parts = [req.prompt.strip()]
    if req.context and req.context.strip():
        parts.append("Context:\n" + req.context.strip())
    return "\n\n".join(parts)


async def run_intelligence(req: IntelligenceRequest) -> IntelligenceResult:
    """Run a single Antigravity turn (no filesystem/shell tools)."""
    try:
        from google.antigravity import Agent, LocalAgentConfig
        from google.antigravity.types import BuiltinTools, CapabilitiesConfig
    except ImportError as exc:
        return IntelligenceResult(
            ok=False,
            text="",
            mode=req.mode,
            error=f"google-antigravity not installed: {exc}",
        )

    api_key = resolve_api_key()
    if not api_key:
        return IntelligenceResult(
            ok=False,
            text="",
            mode=req.mode,
            error="GEMINI_API_KEY (or GOOGLE_API_KEY) is not configured",
        )

    import uuid

    run_id = f"run_intel_{uuid.uuid4().hex[:12]}"
    config = LocalAgentConfig(
        api_key=api_key,
        system_instructions=_system_for_mode(req.mode),
        capabilities=CapabilitiesConfig(
            # Safe onboard default: finish-only (no shell / FS on control plane)
            enabled_tools=[BuiltinTools.FINISH],
        ),
        conversation_id=req.conversationId or run_id,
    )

    thoughts: list[str] = []
    tool_calls: list[dict[str, Any]] = []
    text = ""

    try:
        agent = Agent(config)
        async with agent:
            response = await agent.chat(_build_prompt(req))
            text = (await response.text()) or ""
            # Best-effort extras (API may vary by SDK version)
            try:
                raw_thoughts = await response.thoughts()
                if raw_thoughts:
                    if isinstance(raw_thoughts, list):
                        thoughts = [str(t) for t in raw_thoughts if t]
                    else:
                        thoughts = [str(raw_thoughts)]
            except Exception:
                pass
            try:
                raw_tools = await response.tool_calls()
                if raw_tools:
                    for tc in raw_tools:
                        if isinstance(tc, dict):
                            tool_calls.append(tc)
                        else:
                            tool_calls.append({"repr": str(tc)})
            except Exception:
                pass
    except Exception as exc:
        logger.exception("antigravity intelligence failed")
        return IntelligenceResult(
            ok=False,
            text="",
            mode=req.mode,
            runId=run_id,
            error=str(exc),
        )

    return IntelligenceResult(
        ok=True,
        text=text.strip(),
        mode=req.mode,
        provider="antigravity",
        thoughts=thoughts,
        toolCalls=tool_calls,
        runId=run_id,
    )


async def maybe_record_trace(
    session: Any,
    *,
    result: IntelligenceResult,
    req: IntelligenceRequest,
) -> None:
    """Optional: write a short run into agent_trace_events when room is set."""
    if not req.tenantId or not req.roomKind or not req.roomId or not result.runId:
        return
    try:
        from bevel_api.repositories import traces as traces_repo

        events: list[dict[str, Any]] = [
            {
                "tenantId": req.tenantId,
                "runId": result.runId,
                "roomKind": req.roomKind,
                "roomId": req.roomId,
                "agentId": req.agentId or "bevel-intel",
                "kind": "run_start",
                "title": f"Onboard intelligence ({req.mode})",
                "status": "running",
                "payload": {"mode": req.mode, "provider": "antigravity"},
            }
        ]
        for i, thought in enumerate(result.thoughts[:20]):
            events.append(
                {
                    "tenantId": req.tenantId,
                    "runId": result.runId,
                    "roomKind": req.roomKind,
                    "roomId": req.roomId,
                    "agentId": req.agentId or "bevel-intel",
                    "kind": "thinking",
                    "title": thought[:200] or f"Thought {i + 1}",
                    "summary": thought[:2000] if len(thought) > 200 else None,
                    "status": "ok",
                    "payload": {"index": i},
                }
            )
        for i, tc in enumerate(result.toolCalls[:20]):
            events.append(
                {
                    "tenantId": req.tenantId,
                    "runId": result.runId,
                    "roomKind": req.roomKind,
                    "roomId": req.roomId,
                    "agentId": req.agentId or "bevel-intel",
                    "kind": "tool_call",
                    "title": str(tc.get("name") or tc.get("tool") or f"Tool {i + 1}")[
                        :200
                    ],
                    "status": "ok",
                    "payload": tc if isinstance(tc, dict) else {"value": tc},
                }
            )
        events.append(
            {
                "tenantId": req.tenantId,
                "runId": result.runId,
                "roomKind": req.roomKind,
                "roomId": req.roomId,
                "agentId": req.agentId or "bevel-intel",
                "kind": "run_end" if result.ok else "run_error",
                "title": "Intelligence complete" if result.ok else "Intelligence failed",
                "summary": (result.text[:500] if result.ok else result.error),
                "status": "ok" if result.ok else "error",
                "payload": {"mode": req.mode},
            }
        )
        await traces_repo.append_events(session, events=events)
        await session.commit()
    except Exception:
        logger.exception("failed to record intelligence trace")
