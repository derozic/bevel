# Developer Experience

Inner-loop speed, toolchain ergonomics, and flow-state protection.

## When to use

- Slow local dev / flaky environments
- Onboarding friction for new engineers / agents
- Tooling standardization (pnpm, uv, nvm)
- Evaluating new platforms for DX cost

## DX scorecard

| Area | Questions |
|------|-----------|
| Time-to-first-PR | <1 day for new hire? |
| Hot reload / feedback | Seconds or minutes? |
| Secrets / env | Documented, not tribal? |
| Docs | Runbook next to code? |
| CI signal | Trustworthy green? |

## House standards

- **pnpm** for JS; **uv** for Python; **nvm** LTS Node (not brew node latest)
- PostgreSQL only — no SQLite fallbacks
- Caddy + `.lvh.me` for local HTTPS (never localhost:3000 culture)
- Failures must be actionable in logs

## Output contract

```markdown
## DX Review — YYYY-MM-DD
**Surface:** ...
**Friction score:** 1-5

### Findings
...

### Fixes (ordered)
| Fix | Effort | Impact | Owner |
```
