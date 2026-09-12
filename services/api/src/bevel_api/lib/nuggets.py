"""Serialize and lint Brad Frost nuggets for track ingest."""

from __future__ import annotations

import json
from typing import Any

NUGGET_PREFIX = "bevel-nugget:v1"
NUGGET_INGEST_URL = "/api/v1/ingest/nuggets"
SCALES = frozenset({"atom", "molecule", "organism", "template", "page"})
PLACEMENTS = frozenset({"thread", "pane", "page"})
ATOM_KINDS = frozenset(
    {"mark", "chip", "metric", "stat", "time", "person", "link", "icon"}
)


def serialize_nugget(payload: dict[str, Any]) -> str:
    body = dict(payload)
    body["v"] = 1
    return f"{NUGGET_PREFIX}\n{json.dumps(body, ensure_ascii=False)}"


def nugget_message(payload: dict[str, Any], *, agent_id: str = "") -> dict[str, Any]:
    """Message dict persisted onto a track. Body is `bevel-nugget:v1` JSON."""
    scale = str(payload.get("scale") or "organism").strip().lower()
    source = str(payload.get("source") or "bevel").strip().lower()
    speaker = source[:80] or "nugget"
    return {
        "speakerId": f"nugget:{source}",
        "speakerName": speaker,
        "speakerType": "system",
        "agentId": (agent_id.strip() or source).lower(),
        "body": serialize_nugget(payload),
        "status": "final",
        "kind": "nugget",
        "tags": ["nugget", "ingest", scale, source],
        "nuggetScale": scale,
        "nuggetSource": source,
    }


def parse_nugget_payload(raw: Any) -> dict[str, Any] | None:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    if text.startswith(NUGGET_PREFIX):
        text = text[len(NUGGET_PREFIX) :].strip()
    try:
        parsed = json.loads(text)
    except (TypeError, ValueError):
        return None
    return parsed if isinstance(parsed, dict) else None


def lint_nugget(payload: dict[str, Any], path: str = "nugget") -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    scale = str(payload.get("scale") or "").strip().lower()
    title = str(payload.get("title") or "").strip()
    source = str(payload.get("source") or "").strip()
    if scale not in SCALES:
        issues.append(
            {
                "level": "error",
                "code": "scale.unknown",
                "message": f"{path}: scale must be atom|molecule|organism|template|page",
            }
        )
    if not title:
        issues.append(
            {
                "level": "error",
                "code": "title.required",
                "message": f"{path}: title is required",
            }
        )
    if not source:
        issues.append(
            {
                "level": "error",
                "code": "source.required",
                "message": f"{path}: source is required",
            }
        )
    atoms = payload.get("atoms") or []
    if not isinstance(atoms, list):
        atoms = []
    for i, atom in enumerate(atoms):
        if not isinstance(atom, dict):
            continue
        kind = str(atom.get("kind") or "").strip().lower()
        if kind not in ATOM_KINDS:
            issues.append(
                {
                    "level": "error",
                    "code": "atom.kind",
                    "message": (
                        f"{path}.atoms[{i}]: kind must be "
                        "mark|chip|metric|stat|time|person|link|icon"
                    ),
                }
            )
    n = len(atoms)
    sections = payload.get("sections") or []
    if not isinstance(sections, list):
        sections = []
    if scale == "atom":
        if n == 0:
            issues.append(
                {
                    "level": "error",
                    "code": "atom.empty",
                    "message": f"{path}: an atom needs one chip, icon, or metric.",
                }
            )
        if n > 2:
            issues.append(
                {
                    "level": "error",
                    "code": "atom.too-big",
                    "message": f"{path}: an atom is indivisible — promote extra facts to a molecule.",
                }
            )
    if scale == "molecule" and n < 2:
        issues.append(
            {
                "level": "error",
                "code": "molecule.too-small",
                "message": f"{path}: a molecule bonds two or more atoms.",
            }
        )
    if scale in {"template", "page"} and not sections:
        issues.append(
            {
                "level": "error",
                "code": f"{scale}.empty",
                "message": f"{path}: a {scale} needs sections (real content / wireframe blocks).",
            }
        )
    related = payload.get("related") or []
    if isinstance(related, list):
        for i, child in enumerate(related):
            if isinstance(child, dict):
                issues.extend(lint_nugget(child, f"{path}.related[{i}]"))
    return issues
