# Workflow Orchestration

Cross-director workflows: triggers, owners, SLAs, and automation boundaries.

## When to use

- Multi-agent processes (deal desk, launch, incident)
- Automating handoffs without losing accountability
- Mapping as-is vs to-be process

## Workflow spec fields

| Field | Content |
|-------|---------|
| Trigger | event / schedule / manual |
| Steps | ordered with owner |
| SLA | per step |
| Systems | tools of record |
| Failure | retry / escalate |
| Metrics | throughput, lag, error |

## Rules

- Every step has a human or agent owner
- Prefer events over polling when possible
- Do not automate ambiguous decisions — route them
- Observability required before automation

## Output contract

```markdown
## Workflow Spec — YYYY-MM-DD
**Name:** ...
**Trigger:** ...

### Steps
| # | Step | Owner | SLA | System |

### SLOs
...

### Escalation
...
```
