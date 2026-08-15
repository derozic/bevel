# Testing — keep the core solid

BEVEL is used live on bevel.is. New work (SMS / “Take it mobile”, Matrix, etc.)
must not take down login, Private, conversations, or persistence.

## Layers

| Layer | Command | What it guards |
| --- | --- | --- |
| Unit (JS) | `pnpm test:vitest` | Paths, rail session rows, chat message coercion, feature flags |
| Mentions | `pnpm test:mentions` | `@` / `^` parse + chip CSS invariants |
| Provision | `pnpm test:provision` | Tenant claim / slug rules |
| API (Python) | `pnpm test:api` | Message upsert, mentions, health, Matrix |
| Device | `./scripts/mobile/device-qa.sh` | iPad / iPhone / macOS consumer chat |
| Smoke | `./scripts/deploy-production.sh` curls | Live health after deploy |

Run the whole foundation before push:

```bash
pnpm test
```

Watch JS while editing:

```bash
pnpm test:watch
```

## Where to add tests

- **Workspace / chat crash paths** — `apps/web/src/lib/*.spec.ts`
- **Realtime message shape** — `packages/realtime-client/src/**/*.spec.ts`
- **Flags (SMS must not disable chat)** — `packages/schema/src/featuresets.spec.ts`
- **Postgres persistence** — `services/api/tests/test_*.py`

When you add a feature:

1. Write a spec that the **existing** surface still works (Private `/me`, `/talk/:agent`, session list, message upsert).
2. Write a spec for the new contract (e.g. SMS gated on paid plans; conversations work when `sms: false`).
3. Run `pnpm test` before deploy.

## Weekend reliability bar

- Login → Private → New conversation must not throw.
- Refreshing a `/talk/:agent` URL resumes the same `dm-{user}-{roster}` thread.
- Archive rows with missing `agentIds` or empty `body` cannot crash the rail or thread.
- `pnpm test` is green on the SHA that `./scripts/deploy-production.sh` ships.
