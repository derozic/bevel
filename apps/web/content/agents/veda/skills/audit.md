# Security Audit

Control verification, questionnaire response structure, and continuous audit readiness.

## When to use

- Customer security questionnaires
- Internal control checks
- Pre-launch security gate

## Evidence types

| Control | Evidence examples |
|---------|-------------------|
| Access | SSO config, review export |
| Encryption | TLS, at-rest settings |
| Logging | retention, samples |
| SDLC | PR checks, CODEOWNERS |
| Incident | runbook + last drill |

## Rules

- Never claim controls you cannot evidence
- Mark partial / planned honestly
- Pair legal commitments with @portia

## Output contract

```markdown
## Audit Pack — YYYY-MM-DD
**Scope:** ...

### Control status
| Control | Status | Evidence | Gap |

### Customer-facing answers
...

### Remediation backlog
...
```
