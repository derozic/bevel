# Google Antigravity — onboard default intelligence

Bevel uses the **[Google Antigravity SDK](https://antigravity.google/product/antigravity-sdk)** (`google-antigravity`) as the **default onboard intelligence** provider for control-plane features: chat assist, summarize, draft reply, channel digest, and new-member onboard guidance.

## Status

| Check | Command / path |
|-------|----------------|
| Python package | `google-antigravity` in `services/api/pyproject.toml` |
| Module | `bevel_api.lib.antigravity_intel` |
| API | `GET /api/v1/intelligence/status`, `POST /api/v1/intelligence` |
| Web BFF | `GET/POST /api/intelligence` |
| Prefs | `ai.activeProvider: 'antigravity'` (default) |

## Install / sync

```bash
cd services/api
uv sync
# or
uv add "google-antigravity>=0.1.5"
```

The SDK ships a **platform-specific binary** in the PyPI wheel — install from PyPI, do not rely on a git clone alone.

## Configuration

Set one of:

- `GEMINI_API_KEY`
- `GOOGLE_API_KEY`
- `GOOGLE_GEMINI_API_KEY`

Env is read from the process and from `.env` / `.env.local` under the API and repo root.

## Safety defaults

Control-plane agents use **`BuiltinTools.FINISH` only** — no shell or filesystem tools on the API host. Workspace computer-use / toolful agents belong in Hermes / fleet runners with sandboxes, not the multi-tenant control plane.

## Modes

| Mode | Intent |
|------|--------|
| `chat` | General assist |
| `summarize` | Short bullet summary of context |
| `draft_reply` | Message draft |
| `channel_digest` | Themes, owners, next steps |
| `onboard` | New-member guide (~channels, @/^, Timeline, Trace) |

When `tenantId` + `roomKind` + `roomId` are set and `recordTrace: true`, a short run is written to **Agent Trace**.

## Example

```bash
curl -sS -X POST "$BEVEL_API/api/v1/intelligence" \
  -H "Content-Type: application/json" \
  -H "X-Fleet-Internal-Key: $FLEET_INTERNAL_API_KEY" \
  -d '{
    "mode": "onboard",
    "prompt": "I just joined. What should I do first?",
    "tenantId": "2x4m",
    "roomKind": "agent_session",
    "roomId": "dm-me-bevel-intel"
  }'
```

## Related

- Agent Trace: `docs/AGENT_TRACE.md`
- Hermes desktop (toolful local agent): `docs/HERMES_DESKTOP.md`
- Preso uses the same SDK for slide scaffold / transcription
