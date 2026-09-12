# Quality KPIs

Metrics that predict reliability — not vanity coverage %.

## When to use

- Defining quality bars for a product
- Test strategy with @lego
- Release readiness reviews

## Preferred KPIs

| KPI | Why it matters |
|-----|----------------|
| Change failure rate | Real user pain |
| Escaped defects / release | Process holes |
| Flake rate | Signal integrity |
| Critical path coverage | Risk-based, not global % |
| MTTR | Recovery muscle |
| a11y / security gate pass | Non-functional floor |

## Rules

- Prefer fewer KPIs with owners
- Pair every KPI with a counter-metric (e.g. speed vs fail rate)
- Coverage % alone is insufficient for ship decisions

## Output contract

```markdown
## Quality KPI Pack — YYYY-MM-DD
**Product:** ...

### KPIs
| KPI | Current | Target | Owner | Data source |

### Gaps
...

### Release recommendation
ship | hold | canary
```
