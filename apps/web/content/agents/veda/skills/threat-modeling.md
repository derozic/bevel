# Threat Modeling

Lightweight threat models for features and systems before they ship.

## When to use

- New auth surfaces, multi-tenant data, agents with tools
- External integrations
- High-risk launches with @helm / @portia

## Method (STRIDE-lite)

| Threat | Questions |
|--------|-----------|
| Spoofing | Who authenticates? How? |
| Tampering | What integrity checks? |
| Repudiation | Audit logs? |
| Info disclosure | Data classes? |
| DoS | Rate limits / cost bombs? |
| Elevation | Authz boundaries? |

## Also cover

- Prompt injection / tool abuse for agents
- SSRF, path traversal on file tools
- Supply chain (deps, models)

## Output contract

```markdown
## Threat Model — YYYY-MM-DD
**System:** ...
**Risk:** high | medium | low

### Assets
...

### Trust boundaries
...

### Threats & mitigations
| Threat | Mitigation | Owner | Status |

### Residual risk
...
```
