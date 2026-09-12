# Operational Metrics

Cross-org operational scorecards: flow, reliability, and handoff health.

## When to use

- Weekly ops reviews
- Defining shared KPIs across directors
- Incident / deploy correlation views

## Metric families

| Family | Examples |
|--------|----------|
| Flow | lead time, WIP, handoff lag |
| Reliability | uptime, error budget, MTTR |
| GTM ops | pipeline hygiene lag, contract turnaround |
| Cost ops | unit cost trends (@mildred) |
| Security ops | time-to-patch, access review completion |

## Rules

- Few metrics, high trust data sources
- Pair with owners and review cadence
- Avoid metric theater (dashboards nobody uses)

## Output contract

```markdown
## Ops Scorecard — YYYY-MM-DD
**Period:** ...

### Metrics
| Metric | Value | Target | Trend | Owner |

### Alerts
...

### Decisions
...
```
