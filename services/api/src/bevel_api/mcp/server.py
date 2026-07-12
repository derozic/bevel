"""BEVEL MCP server — tools call the control-plane HTTP API (not shell hacks)."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

API_BASE = os.getenv("BEVEL_API_URL", "http://127.0.0.1:43203").rstrip("/")

mcp = FastMCP(
    "bevel",
    instructions=(
        "BEVEL™ control plane MCP. Manage local services (web, admin, realtime), "
        "list tenants/channels/agents, probe health, and open product URLs. "
        "All tools call the BEVEL FastAPI API."
    ),
)


def _client() -> httpx.Client:
    return httpx.Client(base_url=API_BASE, timeout=30.0)


def _get(path: str, **params: Any) -> Any:
    with _client() as client:
        res = client.get(path, params={k: v for k, v in params.items() if v is not None})
        res.raise_for_status()
        return res.json()


def _post(path: str, body: dict[str, Any] | None = None) -> Any:
    with _client() as client:
        res = client.post(path, json=body or {})
        res.raise_for_status()
        return res.json()


@mcp.tool()
def bevel_health() -> str:
    """Health of the BEVEL control API and realtime dependency."""
    return json.dumps(_get("/health"), indent=2)


@mcp.tool()
def bevel_services_status() -> str:
    """Status of web, admin, realtime, and api processes."""
    return json.dumps(_get("/api/v1/services"), indent=2)


@mcp.tool()
def bevel_services_monitor() -> str:
    """One-shot monitor snapshot (same as status; for agent loops)."""
    return json.dumps(_get("/api/v1/services/monitor/snapshot"), indent=2)


@mcp.tool()
def bevel_services_start(only: str = "") -> str:
    """Start BEVEL services. Optional comma-separated only=web,realtime,admin."""
    body: dict[str, Any] = {}
    if only.strip():
        body["only"] = [p.strip() for p in only.split(",") if p.strip()]
    return json.dumps(_post("/api/v1/services/start", body), indent=2)


@mcp.tool()
def bevel_services_stop(only: str = "") -> str:
    """Stop BEVEL services. Optional comma-separated only=web,realtime,admin."""
    body: dict[str, Any] = {}
    if only.strip():
        body["only"] = [p.strip() for p in only.split(",") if p.strip()]
    return json.dumps(_post("/api/v1/services/stop", body), indent=2)


@mcp.tool()
def bevel_list_tenants() -> str:
    """List declarative tenants from tenants/*/bevel.yaml."""
    return json.dumps(_get("/api/v1/tenants"), indent=2)


@mcp.tool()
def bevel_get_tenant(slug: str) -> str:
    """Get a tenant summary by slug (e.g. demo, 2x4m, acme)."""
    return json.dumps(_get(f"/api/v1/tenants/{slug}"), indent=2)


@mcp.tool()
def bevel_list_channels(tenant_slug: str = "demo") -> str:
    """List channels for a tenant (product surface)."""
    return json.dumps(_get(f"/api/v1/tenants/{tenant_slug}/channels"), indent=2)


@mcp.tool()
def bevel_list_agents() -> str:
    """List fleet agents available in the product UI."""
    return json.dumps(_get("/api/v1/agents"), indent=2)


@mcp.tool()
def bevel_public_urls() -> str:
    """Canonical HTTPS URLs for web, api, graphql, realtime, admin, login."""
    return json.dumps(_get("/api/v1/urls"), indent=2)


@mcp.tool()
def bevel_search(q: str, limit: int = 25) -> str:
    """
    Search conversation archive via realtime.
    Requires a signed-in realtime JWT in production flows; may return empty without auth.
    """
    return json.dumps(_get("/api/v1/search", q=q, limit=limit), indent=2)


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
