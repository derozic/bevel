"""BEVEL MCP server — tools call the control-plane HTTP API (not shell hacks)."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

API_BASE = os.getenv("BEVEL_API_URL", "http://127.0.0.1:43203").rstrip("/")
FLEET_KEY = (
    os.getenv("FLEET_INTERNAL_API_KEY")
    or os.getenv("BEVEL_API_KEY")
    or os.getenv("BEVEL_INTERNAL_KEY")
    or ""
)
DEFAULT_TENANT = os.getenv("BEVEL_TENANT") or os.getenv("BEVEL_DEFAULT_TENANT") or "2x4m"

mcp = FastMCP(
    "bevel",
    instructions=(
        "BEVEL™ control plane + fleet MCP. Manage services, tenants, channels, "
        "agent memberships (ACL), messages, search, and channel YAML workflows. "
        "All tools call the BEVEL FastAPI API. Prefer fleet_* tools for workspace ops."
    ),
)


def _client() -> httpx.Client:
    headers: dict[str, str] = {}
    if FLEET_KEY:
        headers["X-Fleet-Internal-Key"] = FLEET_KEY
    return httpx.Client(base_url=API_BASE, timeout=30.0, headers=headers)


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


def _put(path: str, body: dict[str, Any] | None = None) -> Any:
    with _client() as client:
        res = client.put(path, json=body or {})
        res.raise_for_status()
        return res.json()


def _delete(path: str) -> Any:
    with _client() as client:
        res = client.delete(path)
        res.raise_for_status()
        return res.json() if res.content else {"ok": True}

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


# ── Fleet (channels, membership ACL, messages, workflows) ─────────────────────


@mcp.tool()
def fleet_list_channels(tenant: str = "") -> str:
    """List workspace channels including agent membership ACL (agentIds)."""
    t = tenant.strip() or DEFAULT_TENANT
    return json.dumps(_get("/api/v1/fleet/channels", tenant=t), indent=2)


@mcp.tool()
def fleet_get_channel(channel: str, tenant: str = "") -> str:
    """Get one channel with agentIds membership roster."""
    t = tenant.strip() or DEFAULT_TENANT
    return json.dumps(
        _get(f"/api/v1/fleet/channels/{channel}", tenant=t),
        indent=2,
    )


@mcp.tool()
def fleet_list_channel_agents(channel: str, tenant: str = "") -> str:
    """List agent members (ACL) for a channel."""
    t = tenant.strip() or DEFAULT_TENANT
    return json.dumps(
        _get(f"/api/v1/fleet/channels/{channel}/agents", tenant=t),
        indent=2,
    )


@mcp.tool()
def fleet_add_channel_agent(channel: str, agent_id: str, tenant: str = "") -> str:
    """Add an agent as a channel member (ACL)."""
    t = tenant.strip() or DEFAULT_TENANT
    return json.dumps(
        _put(
            f"/api/v1/fleet/channels/{channel}/agents/{agent_id}?tenant={t}",
            {"addedBy": "mcp"},
        ),
        indent=2,
    )

@mcp.tool()
def fleet_remove_channel_agent(channel: str, agent_id: str, tenant: str = "") -> str:
    """Remove an agent from a channel membership ACL."""
    t = tenant.strip() or DEFAULT_TENANT
    return json.dumps(
        _delete(f"/api/v1/fleet/channels/{channel}/agents/{agent_id}?tenant={t}"),
        indent=2,
    )


@mcp.tool()
def fleet_set_channel_agents(channel: str, agent_ids: str, tenant: str = "") -> str:
    """Replace channel agent roster. agent_ids is comma-separated (e.g. hermes,johnny,brain)."""
    t = tenant.strip() or DEFAULT_TENANT
    ids = [a.strip() for a in agent_ids.split(",") if a.strip()]
    return json.dumps(
        _put(
            f"/api/v1/fleet/channels/{channel}/agents?tenant={t}",
            {"agentIds": ids, "addedBy": "mcp"},
        ),
        indent=2,
    )


@mcp.tool()
def fleet_list_messages(channel: str, tenant: str = "", limit: int = 50) -> str:
    """List recent messages in a channel (oldest→newest)."""
    t = tenant.strip() or DEFAULT_TENANT
    return json.dumps(
        _get(
            f"/api/v1/fleet/channels/{channel}/messages",
            tenant=t,
            limit=limit,
        ),
        indent=2,
    )


@mcp.tool()
def fleet_post_message(
    channel: str,
    body: str,
    tenant: str = "",
    speaker_name: str = "mcp",
    agent_id: str = "",
) -> str:
    """Post a message to a channel. Optional agent_id marks speaker as agent."""
    t = tenant.strip() or DEFAULT_TENANT
    payload: dict[str, Any] = {
        "body": body,
        "speakerId": f"agent:{agent_id}" if agent_id else "mcp:operator",
        "speakerName": agent_id or speaker_name,
        "speakerType": "agent" if agent_id else "human",
        "status": "final",
        "tags": ["mcp"],
    }
    if agent_id:
        payload["agentId"] = agent_id
    return json.dumps(
        _post(f"/api/v1/fleet/channels/{channel}/messages?tenant={t}", payload),
        indent=2,
    )


@mcp.tool()
def fleet_search_messages(
    q: str,
    tenant: str = "",
    channel: str = "",
    limit: int = 50,
) -> str:
    """Search message bodies (ILIKE) across a tenant; optional channel filter."""
    t = tenant.strip() or DEFAULT_TENANT
    params: dict[str, Any] = {"q": q, "tenant": t, "limit": limit}
    if channel.strip():
        params["channel"] = channel.strip()
    return json.dumps(_get("/api/v1/fleet/search", **params), indent=2)


@mcp.tool()
def fleet_list_workflows(channel: str, tenant: str = "") -> str:
    """List channel YAML workflows."""
    t = tenant.strip() or DEFAULT_TENANT
    return json.dumps(
        _get(f"/api/v1/fleet/channels/{channel}/workflows", tenant=t),
        indent=2,
    )


@mcp.tool()
def fleet_create_workflow(
    channel: str,
    name: str,
    definition_json: str = "",
    tenant: str = "",
) -> str:
    """
    Create/upsert a channel workflow. definition_json is optional JSON:
    {"trigger":{"on":"message_posted","filter":"contains:P1"},
     "steps":[{"action":"mention_agent","agent":"johnny"}]}
    """
    t = tenant.strip() or DEFAULT_TENANT
    definition: dict[str, Any]
    if definition_json.strip():
        definition = json.loads(definition_json)
    else:
        definition = {
            "name": name,
            "trigger": {"on": "message_posted", "filter": "contains:P1"},
            "steps": [{"id": "ping", "action": "mention_agent", "agent": "johnny"}],
        }
    return json.dumps(
        _post(
            f"/api/v1/fleet/channels/{channel}/workflows?tenant={t}",
            {"name": name, "enabled": True, "definition": definition},
        ),
        indent=2,
    )


@mcp.tool()
def fleet_delete_workflow(channel: str, workflow_id: str, tenant: str = "") -> str:
    """Delete a channel workflow by id."""
    t = tenant.strip() or DEFAULT_TENANT
    return json.dumps(
        _delete(
            f"/api/v1/fleet/channels/{channel}/workflows/{workflow_id}?tenant={t}"
        ),
        indent=2,
    )


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
