"""Workspace membership roster (tenants/memberships.yaml).

Mirrors packages/tenant-config memberships.ts so the API can authorize
webhook/tag mutations against the same person → workspace map.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

from bevel_api.config import settings
from bevel_api.lib import tenants as yaml_tenants

MembershipRole = str


def _memberships_path() -> Path:
    candidate = settings.tenants_root() / "memberships.yaml"
    if candidate.is_file():
        return candidate
    here = Path(__file__).resolve()
    for parent in here.parents:
        alt = parent / "tenants" / "memberships.yaml"
        if alt.is_file():
            return alt
    return candidate


@lru_cache(maxsize=1)
def _load_map() -> dict[str, list[tuple[str, MembershipRole]]]:
    path = _memberships_path()
    out: dict[str, list[tuple[str, MembershipRole]]] = {}
    if not path.is_file():
        return out
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError):
        return out
    if not isinstance(raw, dict):
        return out
    people = raw.get("people") or {}
    if not isinstance(people, dict):
        return out
    for email, rows in people.items():
        key = str(email or "").strip().lower()
        if not key or not isinstance(rows, list):
            continue
        list_rows: list[tuple[str, MembershipRole]] = []
        for row in rows:
            if isinstance(row, str):
                slug = row.strip().lower()
                if slug:
                    list_rows.append((slug, "member"))
                continue
            if not isinstance(row, dict):
                continue
            slug = str(row.get("workspace") or "").strip().lower()
            if not slug:
                continue
            role_raw = str(row.get("role") or "member").strip().lower()
            role = role_raw if role_raw in {"admin", "owner"} else "member"
            list_rows.append((slug, role))
        if list_rows:
            out[key] = list_rows
    return out


def refresh_memberships() -> None:
    _load_map.cache_clear()


def list_memberships_for_email(email: str) -> list[tuple[str, MembershipRole]]:
    key = (email or "").strip().lower()
    return list(_load_map().get(key) or [])


def email_is_member_of(email: str, workspace: str) -> bool:
    slug = (workspace or "").strip().lower()
    return any(row[0] == slug for row in list_memberships_for_email(email))


def workspace_has_roster(workspace: str) -> bool:
    slug = (workspace or "").strip().lower()
    for rows in _load_map().values():
        if any(row[0] == slug for row in rows):
            return True
    return False


def _yaml_allowlists(slug: str) -> tuple[list[str], list[str]]:
    try:
        raw = yaml_tenants.load_tenant(slug)
    except FileNotFoundError:
        return [], []
    auth = raw.get("auth") if isinstance(raw.get("auth"), dict) else {}
    emails = [
        str(e).strip().lower()
        for e in (auth.get("allowed_emails") or [])
        if str(e).strip()
    ]
    domains = [
        str(d).strip().lower()
        for d in (auth.get("allowed_domains") or [])
        if str(d).strip()
    ]
    return emails, domains


def user_may_access_workspace(
    email: str,
    slug: str,
    *,
    home_slug: str | None = None,
) -> bool:
    """True when this person may operate on the workspace.

    Order: explicit roster, home tenant, YAML email/domain allowlist.
    A rostered workspace stays closed to anyone not on that roster (or home).
    """
    normalized = (email or "").strip().lower()
    workspace = (slug or "").strip().lower()
    if not normalized or not workspace:
        return False
    if email_is_member_of(normalized, workspace):
        return True
    if home_slug and home_slug.strip().lower() == workspace:
        return True
    emails, domains = _yaml_allowlists(workspace)
    if normalized in emails:
        return True
    domain = normalized.split("@")[-1] if "@" in normalized else ""
    if domain and domain in domains:
        return True
    if workspace_has_roster(workspace):
        return False
    return False
