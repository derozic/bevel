# Secrets Management

API keys, tokens, credentials: storage, rotation, and never-in-git discipline.

## When to use

- New secret introduction
- Suspected leak
- Rotation schedules
- Agent / CI secret wiring

## Rules

- **1Password / secrets manager** for humans; CI via OIDC/short-lived when possible
- Never commit secrets; rotate if exposed
- Scope keys least privilege; separate prod/dev
- Hermes/gateway keys live in `~/.hermes/.env` with tight perms — not in chat
- Document secret *names*, not values

## Incident (suspected leak)

1. Revoke / rotate immediately
2. Inventory where used
3. Audit logs for abuse
4. Postmortem with @cadence learn loop
5. Add prevention control

## Output contract

```markdown
## Secrets Note — YYYY-MM-DD
**System:** ...
**Action:** introduce | rotate | revoke | audit

### Names (not values)
...

### Blast radius
...

### Follow-ups
...
```
