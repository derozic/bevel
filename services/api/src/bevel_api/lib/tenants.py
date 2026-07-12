"""Declarative tenant reads from tenants/*/bevel.yaml."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from bevel_api.config import settings


def list_tenant_slugs() -> list[str]:
    root = settings.tenants_root()
    if not root.is_dir():
        return []
    slugs: list[str] = []
    for path in sorted(root.iterdir()):
        if path.is_dir() and (path / "bevel.yaml").is_file():
            slugs.append(path.name)
    return slugs


def load_tenant(slug: str) -> dict[str, Any]:
    path = settings.tenants_root() / slug / "bevel.yaml"
    if not path.is_file():
        raise FileNotFoundError(f"tenant not found: {slug}")
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError(f"invalid bevel.yaml for {slug}")
    data["_slug"] = slug
    data["_path"] = str(path)
    theme_path = settings.tenants_root() / slug / "theme.json"
    data["_has_theme"] = theme_path.is_file()
    return data


def list_tenants() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for slug in list_tenant_slugs():
        try:
            out.append(summarize_tenant(load_tenant(slug)))
        except (OSError, ValueError, yaml.YAMLError):
            out.append({"slug": slug, "error": "failed to load"})
    return out


def summarize_tenant(raw: dict[str, Any]) -> dict[str, Any]:
    slug = str(raw.get("_slug") or raw.get("tenant") or "")
    brand = raw.get("brand") if isinstance(raw.get("brand"), dict) else {}
    auth = raw.get("auth") if isinstance(raw.get("auth"), dict) else {}
    realtime = raw.get("realtime") if isinstance(raw.get("realtime"), dict) else {}
    hosts = raw.get("hosts") if isinstance(raw.get("hosts"), list) else []
    features = raw.get("features") if isinstance(raw.get("features"), dict) else {}
    return {
        "slug": slug,
        "name": raw.get("name") or brand.get("product_name") or slug,
        "domain": raw.get("domain"),
        "hosts": hosts,
        "auth_mode": auth.get("mode"),
        "allowed_domains": auth.get("allowed_domains") or [],
        "realtime_namespace": realtime.get("namespace") or slug,
        "realtime_url": realtime.get("url") or settings.public_realtime_url,
        "features": features,
        "has_theme": bool(raw.get("_has_theme")),
        "path": raw.get("_path"),
    }


def tenant_channels(slug: str) -> list[dict[str, Any]]:
    """Channels are not fully declarative yet — return product defaults."""
    _ = load_tenant(slug)  # ensure exists
    return [
        {
            "slug": "general",
            "name": "General",
            "tags": ["bevel", "general"],
            "href": f"/bevel/general",
        }
    ]


def catalog_agents() -> list[dict[str, Any]]:
    """Static fleet catalog aligned with web agent-catalog ids."""
    return [
        {"id": "loom", "name": "Loom", "role": "Fleet brain"},
        {"id": "northstar", "name": "Northstar", "role": "Thread weaver"},
        {"id": "lego", "name": "Lego", "role": "Signal scout"},
        {"id": "tegan", "name": "Tegan", "role": "Test stack"},
        {"id": "johnny", "name": "Johnny", "role": "Surface craft"},
        {"id": "hermes", "name": "Hermes", "role": "Night shift"},
        {"id": "terry", "name": "Terry", "role": "Ops"},
        {"id": "forge", "name": "Forge", "role": "Builder"},
    ]
