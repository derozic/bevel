# BEVEL

Multi-tenant workspace channels for humans and agents.

BEVEL is a standalone product (extracted from the 2x4m/agents stack) with a first-class **tenant/domain contract**, separate **realtime transport**, and an **operator console** for custom domain setup.

## Monorepo layout

```
bevel/
  apps/
    web/           # Next.js tenant app (Host → tenant)
    admin/         # Operator console (domain CNAME, tenants)
    docs/          # Developer documentation
  services/
    realtime/      # Colyseus websocket / presence / sessions
    events/        # Async events, queues, webhooks
    domains/       # Custom domain verification
  packages/
    tenant-config/ # getTenantFromRequest() + middleware
    schema/        # Zod contracts
    realtime-client/
    auth/
    ui/
    design-system/
    analytics/
    config/
    sdk/
```

## Tenant resolution

Following the [Next.js multi-tenant guide](https://nextjs.org/docs/app/guides/multi-tenant), tenants resolve from the `Host` header at middleware:

```
Host: bevel.theirdomain.com
  → tenant lookup
  → theme / config / features
  → auth policy
  → realtime namespace
  → render tenant app
```

Developer API:

```ts
import { getTenantFromRequest } from '@bevel/tenant-config'

const tenant = await getTenantFromRequest()
```

Custom domains: `bevel.theirdomain.com CNAME cname.bevel.com`

## Quick start

```bash
pnpm install
cp .env.example .env

# Terminal 1 — apps + services
./scripts/dev.sh

# Terminal 2 — HTTPS routing (optional)
caddy run --config caddy/Caddyfile
```

| Surface | Dev URL |
|---------|---------|
| Tenant (demo) | https://demo.bevel.lvh.me |
| Admin | https://admin.bevel.lvh.me |
| Realtime | https://realtime.bevel.lvh.me |
| Docs | https://docs.bevel.lvh.me |

## Tooling

- **pnpm** workspaces
- **Nx** task orchestration (`nx dev web`, `nx build --all`)
- **Next.js 15** App Router on Vercel/Cloudflare-style edge deployment
- **Colyseus** realtime in `services/realtime` (not in the Next.js bundle)

## Migration notes

UI and chat client code migrated from `@derozic/fleet-ui` → `@bevel/realtime-client`.  
Realtime server migrated from `agents/apps/realtime` → `services/realtime`.  
Admin UX patterns borrowed from decli; auth/Radix patterns from 2x4m.

## License

MIT