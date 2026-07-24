# Production uptime — bevel.2x4m.cc

## Public surfaces

| Surface | URL | Process |
|---------|-----|---------|
| Workspace | https://bevel.2x4m.cc | `2x4m-bevel.service` → `:41009` |
| Platform entry | https://bevel.is | same Next process |
| Status | https://status.bevel.is | same (rewrite `/` → `/status`) |
| API | https://api.bevel.is | `bevel-api.service` → `:43203` |
| Realtime | https://realtime.bevel.is | `bevel-realtime.service` → `:43208` |
| Postgres | localhost only | `postgresql` DB `bevel` |

## Health checks

```bash
curl -sS https://bevel.2x4m.cc/api/health | jq .
curl -sS https://api.bevel.is/health | jq .
# expect database.status=ok and realtime=ok
curl -sS https://realtime.bevel.is/health | jq .
curl -sS -o /dev/null -w '%{http_code}\n' https://bevel.2x4m.cc/login
curl -sS -o /dev/null -w '%{http_code}\n' https://bevel.is/login
```

Human dashboard: https://status.bevel.is/

## systemd expectations

All three units should be `enabled` + `active`:

- `2x4m-bevel.service` — `Restart=always`
- `bevel-api.service` — `Restart=on-failure` (or `always`)
- `bevel-realtime.service` — `Restart=on-failure` (or `always`)
- `postgresql` / `caddy` — host shared services

```bash
systemctl is-active 2x4m-bevel bevel-api bevel-realtime caddy postgresql
journalctl -u bevel-api -u bevel-realtime -u 2x4m-bevel -n 50 --no-pager
```

## Deploy checklist (no downtime order)

1. `git fetch && git reset --hard origin/main` as `deploy` in `/opt/bevel`
2. API: `cd services/api && uv sync && uv run alembic upgrade head && systemctl restart bevel-api`
3. Realtime: `cd services/realtime && pnpm run build && systemctl restart bevel-realtime`
4. Web: update `apps/web/.env.production` public URLs → `next build` → `systemctl restart 2x4m-bevel`
5. Smoke the four curls above

**Never** `pkill caddy` — reload only (`caddy reload --config /etc/caddy/Caddyfile`).

## Failure modes

| Symptom | Check |
|---------|--------|
| Workspace 200 but chat dead | realtime unit + `https://realtime.bevel.is/health` |
| Login 500 on bevel.is | platform entry tenant resolution (synthetic `platform` tenant) |
| Messages not persisting | API health DB counts + `FLEET_INTERNAL_API_KEY` on realtime |
| API 502 | `bevel-api` down or Caddy still pointing at Next |
| Auth loop to localhost | `AUTH_TRUST_HOST`, request-host OAuth, handoff codes |

## Reliability principles

1. **Postgres is SoT** for tenants, channels, messages, handoff, announcements, push tokens.
2. **YAML is seed only** — never the request-time store for product data.
3. **Three processes + Caddy + Postgres** — each with restart policies.
4. **Status page probes product paths**, not only sibling 2x4m apps.
