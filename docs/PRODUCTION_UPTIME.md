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

**One-command (preferred while iterating):**

```bash
# from laptop, after git push
./scripts/deploy-production.sh              # origin/main
./scripts/deploy-production.sh HEAD         # current branch tip (must be pushed)
./scripts/deploy-production.sh <sha>        # specific commit
```

SSH alias: `bevel-prod` → `ubuntu@34.200.88.66` (`~/.ssh/2x4m_ed25519`).

Manual steps (same order the script uses):

1. `git fetch && git reset --hard <ref>` as `deploy` in `/opt/bevel`
2. API: `source services/api/.env` → `uv sync` → `alembic upgrade head` → `systemctl restart bevel-api`
3. Realtime: `pnpm run build` → `systemctl restart bevel-realtime`
4. Web: `NODE_OPTIONS=--max-old-space-size=1536 pnpm run build` in `apps/web` → `systemctl restart 2x4m-bevel`
5. Smoke the four curls above

**Never** `pkill caddy` — reload only (`caddy reload --config /etc/caddy/Caddyfile`).

### Continuous live testing

Push the branch you are building, then redeploy that tip:

```bash
git push origin HEAD
./scripts/deploy-production.sh HEAD
```

Silicon Mac app always talks to live `api.bevel.is` by default (see `apps/mobile/lib/config.dart`).

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
