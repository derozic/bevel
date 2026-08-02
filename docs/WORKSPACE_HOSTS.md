# Multi-workspace hosts + apex identity

## Apex vs workspaces

| Surface | Host | Role |
|---------|------|------|
| **Apex** | `https://bevel.is` | Platform login, profile (`/account`), workspace picker (`/workspaces`), primary agent / AI preference |
| **Workspace** | `bevel.<product>` | Org channels, brand, agents, Trace |

Logging out returns to **bevel.is/login** so the next sign-in re-resolves memberships (no sticky 2x4m assumption).

## Email → workspace (closed membership)

| Email | Workspace | Production host |
|-------|-----------|-----------------|
| `s@derozic.com` | Decli | `https://bevel.decli.dev` |
| `sderozic@gmail.com` | Preso | `https://bevel.pres0.com` |
| `barndough@gmail.com` | Olimbic | `https://bevel.olimbic.games` |
| `rozicscott@gmail.com` | 2ndBrain | `https://bevel.2ndbra.in` |

Configured via `auth.allowed_emails` in each `tenants/*/bevel.yaml`.

**2x4m** no longer lists `derozic.com` on `default_for_domains` (that forced every derozic login into 2x4m).

## Local hosts (Caddy)

```
https://bevel.decli.lvh.me
https://bevel.preso.lvh.me   # + bevel.pres0.lvh.me
https://bevel.olimbic.lvh.me
https://bevel.2ndbrain.lvh.me
```

Reload: `caddy reload --config ~/dev/Caddyfile.global --adapter caddyfile`

## Dogfood: stay on apex after login

```bash
# In apps/web env / systemd
BEVEL_PLATFORM_AUTO_HANDOFF=0
```

With this set, `/welcome` always opens `/workspaces` so you can pick Decli / Preso / Olimbic / 2ndBrain without an auto hop.

## DNS + TLS (production)

Point each production name at the Bevel edge (same IP / CNAME as bevel.is):

- `bevel.decli.dev`
- `bevel.pres0.com`
- `bevel.olimbic.games`
- `bevel.2ndbra.in`

Caddy (or your prod site config) must TLS-terminate and reverse-proxy to the same Next process as `bevel.is` / `bevel.2x4m.cc`. Host header selects the tenant.

## Google OAuth

Add authorized **JavaScript origins** and **redirect URIs** for each host:

```
https://bevel.decli.dev
https://bevel.decli.dev/api/auth/callback/google
… (pres0, olimbic, 2ndbra.in, bevel.is)
```

## Suite nav mark

- SVG: `/brand/bevel-nav-mark.svg`
- React: `BevelNavMark` + `SuiteNav` (right half of marketing header + rail)

## Smoke matrix

1. Sign in on bevel.is with each email → only its workspace listed.
2. Open workspace → channels under that namespace.
3. Sign out → lands on bevel.is/login.
4. Sign in with another email → different workspace (not 2x4m by default).
