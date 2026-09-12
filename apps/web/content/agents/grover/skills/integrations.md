# Integrations

External system integrations: scope, auth, failure modes, and developer experience.

## When to use

- Building or reviewing product integrations
- Partner API design
- Webhook / sync reliability

## Design checklist

- Auth model (OAuth, key, OIDC)
- Rate limits and backoff
- Idempotency
- Partial failure behavior
- Data mapping & PII (@portia / @veda)
- Observability (@flux)
- Versioning & deprecation policy

## Output contract

```markdown
## Integration Spec — YYYY-MM-DD
**Systems:** A ↔ B
**Owner:** ...

### Scope
...

### Auth & data
...

### Failure modes
...

### SLOs
...
```
