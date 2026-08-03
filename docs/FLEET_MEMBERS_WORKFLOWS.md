# Fleet: agents as members, JSON CLI, channel workflows

## Agents as channel members (ACL)

Membership is durable in Postgres (`channel_agent_members`), not just the live Colyseus chip list.

| Concept | Source |
|---------|--------|
| **Roster / ACL** | `channel_agent_members` rows per channel |
| **Defaults** | `channels.default_agent_ids` — seeded into membership on ensure |
| **Realtime** | Loads `agentIds` from fleet API; `@mention` only dispatches **members** |
| **UI** | Agent chip toggle → `PUT /api/fleet/channels/:slug/agents` |

### API

```
GET    /api/v1/fleet/channels/{slug}/agents?tenant=2x4m
PUT    /api/v1/fleet/channels/{slug}/agents/{agentId}?tenant=2x4m
DELETE /api/v1/fleet/channels/{slug}/agents/{agentId}?tenant=2x4m
PUT    /api/v1/fleet/channels/{slug}/agents?tenant=2x4m
       body: { "agentIds": ["hermes","johnny","brain"] }
```

Web BFF: `GET|PUT /api/fleet/channels/:slug/agents` (session).

### Migration

`alembic upgrade head` → revision `0006_agent_members_workflows`.

---

## JSON CLI (`bevel`)

```bash
export BEVEL_API_URL=http://127.0.0.1:43203
export FLEET_INTERNAL_API_KEY=...
export BEVEL_TENANT=2x4m

pnpm --filter @bevel/cli exec tsx src/index.ts channels list
bevel messages search --q "deploy"
bevel agents members --channel general
bevel agents add --channel general --agent loom
bevel agents ask --channel general --agent brain --message "ping"
bevel workflows create --channel ops --name incident
```

Exit codes: `0` ok · `1` input · `2` network · `3` auth.

---

## MCP parity

`uv run bevel-mcp` (from `services/api`) exposes:

| Tool | Mirrors |
|------|---------|
| `fleet_list_channels` | `bevel channels list` |
| `fleet_list_channel_agents` | `bevel agents members` |
| `fleet_add_channel_agent` / `fleet_remove_channel_agent` / `fleet_set_channel_agents` | agents add/remove/roster |
| `fleet_list_messages` / `fleet_post_message` | messages list/post |
| `fleet_search_messages` | messages search |
| `fleet_list_workflows` / `fleet_create_workflow` / `fleet_delete_workflow` | workflows |

Env: `BEVEL_API_URL`, `FLEET_INTERNAL_API_KEY`, optional `BEVEL_TENANT`.

---

## Channel YAML workflows

Stored in `channel_workflows.definition` (JSON; YAML-shaped).

### Shape

```yaml
name: incident-ping
trigger:
  on: message_posted
  filter: "contains:P1"   # or contains(text, 'P1') or bare substring
steps:
  - id: ping
    action: mention_agent
    agent: johnny
    text: "@johnny triage: {{trigger.text}}"
  - id: note
    action: post_message
    text: "Incident workflow fired."
  - id: gate
    action: request_approval
    from: role:admin
    message: "Page on-call?"
```

### Actions

| Action | Effect |
|--------|--------|
| `post_message` | System message on channel |
| `mention_agent` | System message with `@agent` (only if agent is a **member**) |
| `request_approval` | System approval prompt (waiting_approval run status) |

Triggered on `POST .../messages` when status is final and speaker is not system/workflow.

### API

```
GET  /api/v1/fleet/channels/{slug}/workflows?tenant=
POST /api/v1/fleet/channels/{slug}/workflows
DELETE /api/v1/fleet/channels/{slug}/workflows/{id}
```
