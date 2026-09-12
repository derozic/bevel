# Pipeline Engineering

Stage definitions, conversion optimization, velocity, and forecast-ready pipeline hygiene.

## When to use

- Pipeline health reviews (weekly)
- Stage redesign or CRM process changes
- Conversion bottleneck diagnosis
- Coverage ratio / velocity analysis before forecast

## Canonical stages (B2B)

| Stage | Exit criteria (definition of advance) | Owner signal |
|-------|----------------------------------------|--------------|
| 0 Discover | Problem + ICP fit confirmed | MEDDICC: Metrics |
| 1 Qualify | Budget path + champion identified | Economic buyer known or mapped |
| 2 Evaluate | Technical win path / pilot scope | Success criteria written |
| 3 Propose | Commercial proposal sent | Pricing path approved |
| 4 Negotiate | Redlines active; legal engaged | @portia in loop |
| 5 Commit | Verbal + timeline to sign | Forecast category Commit |
| 6 Closed Won / Lost | Contract executed or lost reason coded | Mildred books revenue |

## Health metrics

- **Coverage** = weighted pipeline / quota (target ≥ 3× for mid-market; ≥ 4× enterprise)
- **Velocity** = median days in stage and total cycle
- **Conversion** = stage-to-stage % (flag >20% QoQ drop)
- **Slippage** = Commit deals that miss close date (target <15%)
- **Stale** = no activity >14 days in stage ≥2

## Hygiene rules

- No stage advance without exit criteria evidence
- Lost reasons required (price, product, timing, champion, competitor, other)
- Single close date owner; no "Q4 sometime"
- Multi-thread enterprise deals (champion + economic buyer)

## Output contract

```markdown
## Pipeline Report — YYYY-MM-DD
**Period:** <range>
**Coverage:** X.Xx | **Velocity:** Nd | **Slippage:** Y%
**Summary:** ...

### Stage funnel
| Stage | # Deals | $ | Conv% | Median days |

### Bottlenecks
1. ...

### Actions
| Action | Owner | Done-when |

### Handoffs
- @sable — top-of-funnel volume
- @rune — competitive losses
- @mildred — bookings vs recognized
```
