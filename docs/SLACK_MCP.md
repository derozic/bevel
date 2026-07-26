# BEVEL · Slack MCP Server

Configure [Slack’s hosted MCP server](https://docs.slack.dev/ai/slack-mcp-server) so agents (Grok, Claude Code, Cursor, Hermes) can search Slack, read channels/threads, send messages, and manage canvases — **as the user**, under admin-approved app identity.

## Architecture

```
┌──────────────────┐     MCP (Streamable HTTP)      ┌─────────────────────────┐
│  MCP Host        │ ─────────────────────────────► │  Slack MCP Server         │
│  Grok / Claude / │   https://mcp.slack.com/mcp    │  (Slack-hosted)           │
│  Cursor / Hermes │ ◄───────────────────────────── │  tools: search, chat, …   │
└────────┬─────────┘     OAuth user token           └────────────┬────────────┘
         │                                                       │
         │ optional                                              │ Web API
         ▼                                                       ▼
┌──────────────────┐                                  ┌─────────────────────────┐
│  BEVEL MCP       │  stdio → FastAPI                 │  Customer Slack workspace│
│  bevel-mcp       │  (control plane, tenants, …)     │  channels / DMs / files  │
└──────────────────┘                                  └─────────────────────────┘
         │
         │ Extensions UI / CLI
         ▼
┌──────────────────┐
│  bevel.is        │  Connect Slack (bot + user scopes)
│  OAuth callback  │  https://bevel.is/api/integrations/slack/oauth/callback
└──────────────────┘
```

| Server | Transport | Auth | Purpose |
|--------|-----------|------|---------|
| **Slack MCP** | `https://mcp.slack.com/mcp` (JSON-RPC streamable HTTP) | User OAuth (`oauth/v2_user`) | Agent access to Slack data/actions |
| **BEVEL MCP** | stdio `uv run bevel-mcp` | Local / API URL | Control plane: tenants, services, fleet |

**Complement Slack:** agents use Slack MCP for HQ context; BEVEL MCP + channels for agent-native work. Do not replace Slack’s client.

## Prerequisites (Slack app)

1. App at https://api.slack.com/apps — **internal** or **Marketplace-listed** (unlisted apps cannot use MCP).
2. Reuse the same app as the BEVEL Slack bridge when possible (fixed app ID).
3. **OAuth Redirect URLs** (add all that apply):

   | Client | Redirect |
   |--------|----------|
   | BEVEL web install | `https://bevel.is/api/integrations/slack/oauth/callback` |
   | Local BEVEL | `https://bevel.lvh.me/api/integrations/slack/oauth/callback` |
   | Partner MCP hosts | Per Claude / Cursor / Grok OAuth redirect (when using their Slack connector) |

4. **User token scopes** (MCP tools — authorize via `https://slack.com/oauth/v2_user/authorize`):

   See table in Slack docs; BEVEL defaults request a practical set in `apps/web/src/lib/slack/scopes.ts` (`SLACK_MCP_USER_SCOPES`).

5. **Bot scopes** still used for deterministic BEVEL → Slack posts (`chat:write`, etc.) via Web API (not MCP).

6. Env on BEVEL:

```bash
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
SLACK_REDIRECT_URI=https://bevel.is/api/integrations/slack/oauth/callback
# optional: SLACK_APP_ID=A…
```

## OAuth endpoints (MCP user tokens)

| Step | URL |
|------|-----|
| Authorize | `https://slack.com/oauth/v2_user/authorize` |
| Token | `https://slack.com/api/oauth.v2.user.access` |
| Resource metadata | `https://mcp.slack.com/.well-known/oauth-protected-resource` |
| Auth server metadata | `https://mcp.slack.com/.well-known/oauth-authorization-server` |
| MCP endpoint | `https://mcp.slack.com/mcp` |

Discovery supports RFC 8414; MCP clients that implement OAuth metadata can complete consent without custom code.

## Agent client configs

### Grok Build / Cursor-style remote MCP

Print from BEVEL:

```bash
bevel integrations slack mcp-config
# or:
curl -sS https://bevel.is/api/integrations/slack/mcp | jq .
```

Example (host fills OAuth interactively):

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

Repo template: `.mcp.json.example` (copy to client-specific path; never commit secrets).

### Claude Code / Claude.ai

Use Slack’s partner connector where available, or add remote MCP URL `https://mcp.slack.com/mcp` and complete OAuth in the host.

### Hermes / OpenClaw

Prefer Slack MCP for search/send when the host supports remote MCP + OAuth; keep BlueBubbles for **iMessage** only.

## BEVEL Extensions UX

| Surface | Action |
|---------|--------|
| Console → Integrations → Slack | Connect (bot + user scopes for MCP) |
| Console → Settings / MCP | Show BEVEL + Slack MCP config snippets |
| CLI | `bevel integrations slack mcp-config` |
| API | `GET /api/integrations/slack/mcp` |

## Token rotation

Enable **Token Rotation** on the Slack app (OAuth & Permissions).  
BEVEL persists refresh tokens and refreshes access tokens before the 12h expiry.

See [Using token rotation](https://docs.slack.dev/authentication/using-token-rotation/) and `docs/SLACK_INTEGRATION.md` § Token rotation.

- Store: `botRefreshToken` / `userRefreshToken` + `*ExpiresAt`  
- Runtime: `getValidBotToken` / `getValidUserToken`  
- Migrate long-lived: `POST /api/integrations/slack/rotate` `{ "action": "migrate" }`

## Security

- Only **internal** or **Marketplace** apps.  
- Admins approve MCP clients in Slack.  
- Audit: [MCP audit logs](https://docs.slack.dev/reference/audit-logs-api/methods-actions-reference/#mcp-server).  
- IP allowlists on the Slack app apply to MCP traffic too.  
- Do not mix untrusted MCP servers with Slack MCP in the same agent session.  
- Tokens: server-side only (`data/secrets/slack/`); never in browser or git.  
- Refresh tokens are single-use — always replace both access + refresh after `oauth.v2.access`.

## Rate limits

Same as Web API method tiers for each tool (search, chat.postMessage, history, canvases, etc.). Design agent loops with backoff.

## Related

- [SLACK_INTEGRATION.md](./SLACK_INTEGRATION.md) — bridge product strategy  
- [services/api/README.md](../services/api/README.md) — BEVEL MCP  
- Slack: https://docs.slack.dev/ai/slack-mcp-server  
