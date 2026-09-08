"""Platform global agent settings — defaults from agents repo, override file for admin."""

from __future__ import annotations

import json
import os
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bevel_api.config import settings

DEFAULT_PRINCIPLES: dict[str, bool] = {
    "thinkBeforeActing": True,
    "simplicityFirst": True,
    "surgicalChanges": True,
    "goalDrivenExecution": True,
}

DEFAULT_SETTINGS: dict[str, Any] = {
    "version": 1,
    "source": "agents-repo-defaults",
    "enabled": True,
    "principles": dict(DEFAULT_PRINCIPLES),
    "customMarkdown": None,
    "notes": (
        "Karpathy-inspired fleet guidelines. "
        "Canonical markdown lives in agents/src/global/GLOBAL_SETTINGS.md."
    ),
}


def agents_repo_root() -> Path:
    env = os.getenv("AGENTS_REPO_ROOT")
    if env:
        return Path(env).expanduser().resolve()
    # sibling of bevel
    return (settings.bevel_repo_root.parent / "agents").resolve()


def override_path() -> Path:
    env = os.getenv("AGENTS_GLOBAL_SETTINGS_PATH") or os.getenv(
        "BEVEL_AGENT_GLOBAL_SETTINGS_PATH"
    )
    if env:
        return Path(env).expanduser().resolve()
    data_dir = settings.bevel_repo_root / "data"
    return data_dir / "agent-global-settings.json"


def defaults_json_path() -> Path:
    return agents_repo_root() / "src" / "global" / "defaults.json"


def defaults_markdown_path() -> Path:
    return agents_repo_root() / "src" / "global" / "GLOBAL_SETTINGS.md"


def load_builtin_defaults() -> dict[str, Any]:
    out = deepcopy(DEFAULT_SETTINGS)
    p = defaults_json_path()
    if p.is_file():
        try:
            raw = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                principles = {
                    **DEFAULT_PRINCIPLES,
                    **(raw.get("principles") or {}),
                }
                out.update({k: v for k, v in raw.items() if k != "principles"})
                out["principles"] = principles
                out["source"] = raw.get("source") or "agents-repo-defaults"
        except (OSError, json.JSONDecodeError):
            pass
    return out


def load_builtin_markdown() -> str:
    p = defaults_markdown_path()
    if p.is_file():
        try:
            return p.read_text(encoding="utf-8")
        except OSError:
            return ""
    return ""


def load_override() -> dict[str, Any] | None:
    p = override_path()
    if not p.is_file():
        return None
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def merge_settings(
    base: dict[str, Any],
    override: dict[str, Any] | None,
    source: str,
) -> dict[str, Any]:
    if not override:
        return base
    out = deepcopy(base)
    for k, v in override.items():
        if k == "principles" and isinstance(v, dict):
            out["principles"] = {**out.get("principles", {}), **v}
        else:
            out[k] = v
    out["source"] = source
    return out


def load_effective() -> dict[str, Any]:
    base = load_builtin_defaults()
    ov = load_override()
    if ov:
        return merge_settings(base, ov, f"bevel-override:{override_path()}")
    return base


def save_override(body: dict[str, Any], updated_by: str | None = None) -> dict[str, Any]:
    """Persist admin override. Returns effective settings after save."""
    path = override_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    existing = load_override() or {}
    # Only store override fields (not full markdown body unless custom)
    allowed = {
        "enabled",
        "principles",
        "customMarkdown",
        "notes",
        "version",
    }
    next_ov: dict[str, Any] = {k: existing[k] for k in allowed if k in existing}

    if "enabled" in body:
        next_ov["enabled"] = bool(body["enabled"])
    if "principles" in body and isinstance(body["principles"], dict):
        prev = {**DEFAULT_PRINCIPLES, **(next_ov.get("principles") or {})}
        for pk, pv in body["principles"].items():
            if pk in DEFAULT_PRINCIPLES:
                prev[pk] = bool(pv)
        next_ov["principles"] = prev
    if "customMarkdown" in body:
        cm = body["customMarkdown"]
        next_ov["customMarkdown"] = None if cm is None or cm == "" else str(cm)
    if "notes" in body and body["notes"] is not None:
        next_ov["notes"] = str(body["notes"])

    next_ov["version"] = int(body.get("version") or next_ov.get("version") or 1)
    next_ov["updatedAt"] = datetime.now(timezone.utc).isoformat()
    if updated_by:
        next_ov["updatedBy"] = updated_by
    next_ov["source"] = "bevel-admin"

    path.write_text(json.dumps(next_ov, indent=2) + "\n", encoding="utf-8")
    return load_effective()


def public_payload() -> dict[str, Any]:
    effective = load_effective()
    return {
        "effective": effective,
        "builtinMarkdown": load_builtin_markdown(),
        "overridePath": str(override_path()),
        "agentsRepoRoot": str(agents_repo_root()),
        "hasOverride": load_override() is not None,
        "principleLabels": {
            "thinkBeforeActing": "Think Before Acting",
            "simplicityFirst": "Simplicity First",
            "surgicalChanges": "Surgical Changes",
            "goalDrivenExecution": "Goal-Driven Execution",
        },
        "docs": {
            "upstream": "https://github.com/multica-ai/andrej-karpathy-skills",
            "local": "agents/src/global/GLOBAL_SETTINGS.md",
        },
    }
