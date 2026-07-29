# BEVEL control plane (`services/api`)

FastAPI control plane for BEVEL™ with:

- **REST** under `/api/v1/*`
- **Strawberry GraphQL** at `/graphql` (GraphiQL)
- **PostgreSQL** (SQLAlchemy 2 async + asyncpg + Alembic) — **no SQLite**
- **MCP** stdio server (`bevel-mcp`) that calls the REST API

Domain data lives in **PostgreSQL only** (no SQLite, no file JSON, no in-memory maps):

- tenants, users, channels, messages
- auth handoff codes
- announcements
- push tokens

YAML under `tenants/*` is **seed/GitOps input only** (upserted on boot). Legacy
JSONL under `data/fleet/` is a **one-time import** when a tenant has zero messages.

### Conversation durability (in-progress + final)

Postgres `messages` is the source of truth. Realtime (Colyseus) is the live fan-out layer.

| Concern | Behavior |
|---------|----------|
| Write path | `POST /api/v1/fleet/channels/{slug}/messages` **upserts by `id`** |
| Retries | Same message id re-POST is safe (no duplicate rows) |
| Streaming | Clients may re-POST `status: pending\|streaming\|final` with the same id |
| Recovery | `GET /api/v1/fleet/channels/{slug}/messages/in-progress` |
| Pool | `pool_pre_ping`, recycle, configurable `DB_POOL_*` env vars |
| Realtime client | Retries persist up to 3× with timeout (see `fleet-channel-api.ts`) |

## Ports / hosts

| Surface | Local | Public |
|---------|-------|--------|
| API | `127.0.0.1:43203` | https://api.bevel.lvh.me / https://api.bevel.is |
| Docs | | https://api.bevel.lvh.me/docs |
| GraphQL | | https://api.bevel.lvh.me/graphql |

## Database

```bash
export DATABASE_URL=postgresql+asyncpg://bevel:bevel@127.0.0.1:5432/bevel
cd services/api
uv sync
uv run alembic upgrade head
uv run bevel-api   # or: uv run uvicorn bevel_api.main:app --reload --port 43203
```

On boot the API seeds YAML tenants + default channels and one-time-imports any
legacy JSONL under `services/api/data/fleet/` when a tenant has no messages yet.

Health: `GET /health` → `{ database: { status, counts } }`.

## Start

```bash
# Dedicated tab
bash scripts/iterm-tabs/00-api.sh

# Or full stack
bash scripts/services.sh start
# decli
decli bevel api start
decli bevel start
```

## MCP

```bash
cd services/api
uv sync
uv run bevel-mcp
```

Client config (Cursor / Claude / Grok) — **BEVEL + Slack MCP**:

```json
{
  "mcpServers": {
    "bevel": {
      "command": "uv",
      "args": ["run", "bevel-mcp"],
      "cwd": "/Users/YOU/dev/bevel/services/api",
      "env": { "BEVEL_API_URL": "https://api.bevel.is" }
    },
    "slack": {
      "url": "https://mcp.slack.com/mcp",
      "transport": "http"
    }
  }
}
```

Repo template: `.mcp.json.example` · Docs: `docs/SLACK_MCP.md`  
Print live: `bevel integrations slack mcp-config` or `GET /api/integrations/slack/mcp`

Or: `decli bevel mcp`

## REST map (visual UI parity)

| UI concept | API |
|------------|-----|
| Service health | `GET /api/v1/services` |
| Start / stop stack | `POST /api/v1/services/start\|stop` |
| Monitor | `GET /api/v1/services/monitor/snapshot` |
| Tenants | `GET /api/v1/tenants` |
| Channels | `GET /api/v1/tenants/{slug}/channels` |
| Fleet channels (internal) | `GET /api/v1/fleet/channels?tenant=2x4m` |
| Fleet messages (internal) | `GET/POST /api/v1/fleet/channels/{slug}/messages` |
| Workspace messages | `GET /api/v1/workspaces/{slug}/channels/{ch}/messages` |
| Auth handoff issue | `POST /api/v1/auth/handoff` (internal key) |
| Auth handoff redeem | `POST /api/v1/auth/handoff/redeem` |
| Agents (Loom, …) | `GET /api/v1/agents` |
| Sessions archive | `GET /api/v1/sessions` (Bearer realtime JWT) |
| Conversation search | `GET /api/v1/search?q=` |
| Public URLs | `GET /api/v1/urls` |

Production deploy: [docs/PRODUCTION_API.md](../../docs/PRODUCTION_API.md).

## GraphQL examples

```graphql
query {
  health { status service }
  services { name processUp httpUp detail publicUrl }
  tenants { slug name domain }
  agents { id name role }
  urls { web api graphql realtimeHealth }
}

mutation {
  startServices(only: ["web", "realtime"]) { name httpUp }
}
```
