# Access Control

Authn/authz design, reviews, and break-glass procedures.

## When to use

- Role design
- Quarterly access reviews
- Prod break-glass
- Agent tool allowlists

## Principles

- Least privilege, short-lived credentials preferred
- SSO + MFA for humans
- Explicit allowlists for high-impact agent tools
- Separate read vs write vs admin
- Log privileged actions

## Review cadence

| Population | Cadence |
|------------|---------|
| Prod admin | 30–90 days |
| Customer data access | 90 days |
| Agent tool scopes | on change + quarterly |

## Output contract

```markdown
## Access Review — YYYY-MM-DD
**System:** ...

### Roles
...

### Findings
over-privileged | stale | missing MFA

### Remediations
...
```
