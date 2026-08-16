# BEVEL

Multi-tenant workspace channels for humans and agents — a **platform**, not a bespoke deployment.

Every customer domain, theme, auth rule, realtime namespace, and deployment target is **declared**, **validated**, **previewed**, and **released** through the same control plane.

## Monorepo layout

```
bevel/
  tenants/           # Declarative customer surfaces (bevel.yaml + theme.json)
  apps/
    web/             # Next.js tenant app (Host → tenant)
    admin/           # Operator console
    mobile/          # Flutter — iOS, Android, macOS Silicon
    docs/            # Developer documentation
  services/
    realtime/        # WebSocket — live bidirectional (isolated)
    events/          # Async events, queues, webhooks
    domains/         # Custom domain verification
  packages/
    tenant-config/   # Loader + getTenantFromRequest() + doctor
    async-stream/    # SSE — one-way server → client
    realtime-client/ # WebSocket browser client
    suite-chrome/    # Suite dock mark + hover (upstream to product hosts)
    feature-webrtc/  # Optional A/V module (not general realtime)
    cli/             # bevel doctor, validate, list
    schema/          # Zod contracts
    auth/ ui/ …
```

## Product hosts (2x4m, etc.)

**BEVEL features develop in this repo**, then upstream:

| Feature | Lives here | Host app does |
|---------|------------|---------------|
| Suite launch API (`/api/suite/launch`) | `apps/web` | `credentials` fetch |
| Suite dock UX | `packages/suite-chrome` | import + nav placement |
| Chat embed | `packages/realtime-client` | embed component |

Sync dock package into a sibling 2x4m tree:

```bash
./scripts/sync-suite-chrome-to-2x4m.sh
```

Do **not** invent Bevel dock/API logic under `2x4m/packages/ui` — PR here first.

## Transport layers

| Layer | Use for | Transport | Package |
|-------|---------|-----------|---------|
| **1. Async stream** | AI responses, progress, notifications, activity feeds, long jobs | SSE / streamed HTTP | `@bevel/async-stream` |
| **2. Live bidirectional** | Chat, presence, collaboration, shared sessions | WebSocket | `services/realtime` + `@bevel/realtime-client` |
| **3. Live media** | Audio / video / screen only | WebRTC + signaling | `@bevel/feature-webrtc` (opt-in) |

WebSocket runtime stays isolated behind `services/realtime` so the app is not married to one host's implementation (Vercel Functions WS beta, Cloudflare, standalone Node).

## Declarative tenant onboarding

Each customer is a folder under `tenants/`:

```yaml
# tenants/2x4m/bevel.yaml
tenant: 2x4m
domain: bevel.2x4m.cc
hosts:
  - bevel.2x4m.lvh.me          # preview / local alias

brand:
  logo: ./logo.svg
  theme: ./theme.json

features:
  async_streams: true
  live_sessions: true
  analytics: true

auth:
  mode: magic-link
  allowed_domains:
    - 2x4m.cc

realtime:
  namespace: 2x4m
  presence: true
```

Then validate the full surface:

```bash
pnpm bevel doctor 2x4m
```

```
✓ Tenant config valid — bevel.2x4m.cc
✓ Domain CNAME configured — bevel.2x4m.cc → cname.bevel.com
✓ SSL active — https://bevel.2x4m.lvh.me
✓ Theme tokens valid — accent #22c55e
✓ Realtime namespace provisioned — namespace "2x4m" · transport websocket
✓ Auth policy valid — mode: magic-link
✓ Preview deployment healthy — https://bevel.2x4m.lvh.me
```

Offline (config + theme only): `pnpm bevel doctor 2x4m --offline`

## Tenant resolution

```ts
import { getTenantFromRequest } from '@bevel/tenant-config'

const tenant = await getTenantFromRequest()
```

`Host` → tenant lookup → theme / features / auth / realtime namespace → render.

Custom domains: `bevel.theirdomain.com CNAME cname.bevel.com`

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm bevel list
pnpm bevel doctor demo --offline

# Preferred: service scripts (or decli)
bash scripts/services.sh start
# or
decli bevel start
decli bevel monitor
```

Use the **one** machine-wide Caddy (`~/dev/Caddyfile.global`). Reload, don't kill:
```bash
caddy reload --config ~/dev/Caddyfile.global --adapter caddyfile
```

### Start / stop / monitor

| Action | Shell | decli | pnpm |
|--------|-------|-------|------|
| Start all | `bash scripts/services.sh start` | `decli bevel start` | `pnpm services:start` |
| Stop all | `bash scripts/services.sh stop` | `decli bevel stop` | `pnpm services:stop` |
| Status | `bash scripts/services.sh status` | `decli bevel status` | `pnpm services:status` |
| Live monitor | `bash scripts/services.sh monitor` | `decli bevel monitor` | `pnpm services:monitor` |
| URLs | `bash scripts/services.sh urls` | `decli bevel urls` | `pnpm services:urls` |

One process per terminal (iTerm tabs):

```bash
bash scripts/iterm-tabs/00-api.sh       # :43203 control plane
bash scripts/iterm-tabs/01-web.sh       # :43200 web
bash scripts/iterm-tabs/02-realtime.sh  # :43208 realtime
bash scripts/iterm-tabs/03-admin.sh     # :43201 admin
```

### Control plane API + MCP

| Surface | Dev URL |
|---------|---------|
| Tenant (demo) | https://bevel.lvh.me |
| Tenant (2x4m) | https://bevel.2x4m.lvh.me |
| Admin | https://admin.bevel.lvh.me |
| Realtime | https://realtime.bevel.lvh.me |
| **API** | https://api.bevel.lvh.me |
| API docs | https://api.bevel.lvh.me/docs |
| GraphQL | https://api.bevel.lvh.me/graphql |

```bash
# MCP (tools call REST — not shell)
decli bevel mcp          # print client config
pnpm mcp                 # run stdio MCP server
```

## Tooling

- **pnpm** workspaces + **Nx** task graph
- **Next.js 15** multi-tenant app (edge middleware)
- **bevel** CLI — control plane for validate / doctor / list

## License

MIT
## Native clients (iOS · Android · macOS Silicon)

Flutter app: `apps/mobile`. Release bundles:

```bash
./scripts/mobile/release.sh macos     # Apple Silicon .app + zip
./scripts/mobile/release.sh android   # APK + AAB
./scripts/mobile/release.sh ios       # iOS release (signing required for store)
```

See [docs/NATIVE_RELEASE.md](docs/NATIVE_RELEASE.md) and the in-app download page at `/download`.
