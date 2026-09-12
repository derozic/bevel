# BEVEL · Magenta MCP

Magenta’s Streamable HTTP MCP lives in `~/dev/magenta-mono`. BEVEL catalogues it under **Console → Integrations** so agents (Grok, Claude, Cursor, Hermes) can read first-party traffic and reliability without treating uptime probes as visitors.

| | Prod | Local |
|---|---|---|
| MCP | `https://api.magenta.ac/api/v2/mcp` | `https://api.magenta.lvh.me/api/v2/mcp` |
| Manifest | `https://api.magenta.ac/.well-known/mcp.json` | `https://api.magenta.lvh.me/.well-known/mcp.json` |

BEVEL site id: `bevel`.

## Install

```bash
claude mcp add magenta --transport http https://api.magenta.ac/api/v2/mcp
```

Cursor / Grok / Hermes `mcp.json`:

```json
{
  "mcpServers": {
    "magenta": {
      "url": "https://api.magenta.ac/api/v2/mcp",
      "transport": "http"
    }
  }
}
```

Override the URL with `MAGENTA_MCP_URL` (Bevel status probe) if you want local Magenta in development.

## Tools

| Tool | Auth | Use |
|------|------|-----|
| `magenta_traffic` | public | Product events vs `uptime_check` probes |
| `magenta_reliability` | public | Fleet up/down, 30-day availability |
| `magenta_sites` | public | Canonical `site_id` registry |
| `magenta_health` | public | API live payload |
| `magenta_ask` | staff Bearer / Magenta session | Grounded operator answer |

`uptime_check` is Magenta probing itself every 30s per brand. It is not visitor traffic.

## In BEVEL

- Extensions UI: https://bevel.lvh.me/console/integrations (prod: https://bevel.is/console/integrations)
- Status API: `GET /api/integrations/magenta/status` (signed in)
- Preferences → Integrations → Magenta row
