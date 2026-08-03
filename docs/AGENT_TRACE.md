# Agent Trace

Bevel is the **agent ops plane**: every action an agent takes (thinking, tools, computer-use, cloud, handoffs) can be logged in a **parallel stream** next to conversation.

This is **not** the personal Timeline (`@` / `^` inbox). Chat stays human-readable messages; Trace is the structured run log.

## Product

| Surface | Behavior |
|---------|----------|
| Desktop / wide | Nav · Chat · **Trace** (toggleable third column) |
| Fold cover / phone | Chat first; Trace as sheet when toggled |
| Default | **Off** — `preferences.agentTrace.visible` |
| Feature flag | `agentTrace` (pro + beta) |

## Dual format

Each event is both:

- **Human:** `title`, optional `summary` / `bodyMarkdown`
- **Machine:** `kind`, `payload`, `status`, `runId` / span ids

## Schema (TypeScript)

```ts
import {
  AgentTraceEventSchema,
  AgentTraceBatchIngestSchema,
  TRACE_SCHEMA_VERSION,
} from '@bevel/schema'
```

Kinds include: `run_start`, `run_end`, `thinking`, `tool_call`, `tool_result`, `computer`, `browser`, `shell`, `handoff`, `delegate`, …

## API (FastAPI)

All routes require `X-Fleet-Internal-Key` (or trusted BFF session proxy).

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/v1/traces` | Batch ingest `{ events: [...] }` |
| `POST` | `/api/v1/traces/runs` | Open a run |
| `POST` | `/api/v1/traces/runs/{id}/close` | Close a run |
| `GET` | `/api/v1/traces?roomKind=&roomId=&tenantId=` | List events for a room |
| `GET` | `/api/v1/traces/runs/{id}?tenantId=` | Run + events |
| `GET` | `/api/v1/traces/export?...` | NDJSON export |

Web BFF (signed-in):

- `GET/POST /api/traces`
- `GET /api/traces/export`

### Example ingest

```bash
curl -sS -X POST "$BEVEL_API/api/v1/traces" \
  -H "Content-Type: application/json" \
  -H "X-Fleet-Internal-Key: $FLEET_INTERNAL_API_KEY" \
  -d '{
    "events": [{
      "tenantId": "2x4m",
      "runId": "run_demo1",
      "roomKind": "agent_session",
      "roomId": "dm-user-hermes",
      "agentId": "hermes",
      "kind": "thinking",
      "title": "Planning approach",
      "summary": "Will inspect the repo then open a PR.",
      "status": "running",
      "payload": { "phase": "plan" }
    }]
  }'
```

## Postgres

- `agent_runs` — run aggregate
- `agent_trace_events` — append-only steps  
Migration: `0005_agent_trace.py`

Secrets in `payload` are scrubbed server-side when keys/values look like credentials.

## Roadmap (emitters + UI)

1. Fleet runner emits steps around `agent-dispatch`
2. Hermes skill streams tools into bound sessions
3. `TracePane` + 3-col workspace CSS
4. Fold AdaptiveScaffold third column

## Related

- Personal Timeline: mentions / escalations only  
- `~product` agent-activity posts: social accountability, not structured traces  
- Hermes: `docs/HERMES_DESKTOP.md`
