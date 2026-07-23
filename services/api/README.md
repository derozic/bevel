# BEVEL control plane (`services/api`)

FastAPI control plane for BEVEL™ with:

- **REST** under `/api/v1/*`
- **Strawberry GraphQL** at `/graphql` (GraphiQL)
- **PostgreSQL** (SQLAlchemy 2 async + asyncpg + Alembic) — **no SQLite**
- **MCP** stdio server (`bevel-mcp`) that calls the REST API

Domain data (tenants, channels, messages, auth handoff codes) lives in Postgres.
YAML under `tenants/*` is seed/GitOps input only.

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

Client config (Cursor / Claude / Grok):

```json
{
  "mcpServers": {
    "bevel": {
      "command": "uv",
      "args": ["run", "bevel-mcp"],
      "cwd": "/Users/YOU/dev/bevel/services/api",
      "env": { "BEVEL_API_URL": "http://127.0.0.1:43203" }
    }
  }
}
```

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
