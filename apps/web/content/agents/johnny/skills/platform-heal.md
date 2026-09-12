# Platform Heal Skill

On-demand remediation when fleet deploys or dev env drift leaves Caddy routes stale.

## When to run

- After syncing agents, adding a new fleet member, or changing Caddy site configs
- When `agents.2x4m.lvh.me` or `realtime.agents.2x4m.lvh.me` 404/502 over HTTPS but local ports respond
- Before Hermes or other agent rollouts that need chat + realtime green

## What I do

1. **Diagnose** — count Caddy instances, validate `~/dev/Caddyfile.global`, list missing hostnames
2. **Heal** — reload global config (preferred); stop rogue per-project instances only
3. **Patrol** — HTTPS probe every product service; classify green / amber / red
4. **Report** — structured `FleetOpsReport` + human markdown summary

## Commands

```bash
cd ~/dev/2x4m
./scripts/johnny-platform-heal.sh
pnpm --filter @derozic/agents johnny:platform-heal
```

## Rules

- **Reload over restart** — `caddy reload --config ~/dev/Caddyfile.global`
- **Never** blanket `pkill caddy`
- Amber on a sleepy dev backend is fine; red at the TLS layer is mine to chase