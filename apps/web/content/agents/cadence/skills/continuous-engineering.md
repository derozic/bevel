# Continuous Engineering

Default-on engineering health loops: CI health, deploy rhythm, and compounding improvement programs.

## When to use

- Standing up CE on a monorepo / product
- Weekly engineering health briefs
- Diagnosing flaky CI or slow pipelines
- Partnering with @continuous, @northstar, @loom

## CE pillars

1. **Observe** — build, test, deploy, incident signals
2. **Learn** — short retros with one experiment
3. **Change** — small reversible PRs
4. **Measure** — DORA + local KPIs
5. **Remember** — persist lessons in agent memory

## Health snapshot fields

| Signal | Healthy | Investigate |
|--------|---------|-------------|
| Deploy frequency | ≥ daily (svc) | Weekly+ |
| Change fail rate | <15% | Rising trend |
| Cycle time PR→prod | Falling / stable | +50% week |
| CI flake rate | <2% | Quarantine needed |
| Open Sev+ bugs | Trending down | Aging >14d |

## Output contract

```markdown
## CE Brief — YYYY-MM-DD
**Repo / product:** ...
**Health:** green | yellow | red

### Snapshot
...

### Top 3 actions
| Action | Owner | Done-when |

### Specialists
- @lego tests | @northstar eval | @loom optimize
```
