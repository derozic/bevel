# Operating Budgets & Forecasting

Department and product operating budgets, quarterly forecasts, and variance analysis.

## When to use

- Building or revising annual / quarterly OpEx budgets
- Forecast updates and variance reviews
- Headcount cost modeling (with @haven)
- Go / no-go on spend requests

## Budget structure

| Bucket | Includes | Owner signal |
|--------|----------|--------------|
| COGS / infrastructure | Hosting, inference, bandwidth | @flux / @cadence |
| AI usage | Model spend by product | Mildred ledger |
| People | Fully loaded HC | @haven |
| GTM | Ads, tools, events | @sable / @sterling |
| Product & design tools | SaaS, research | @helm / @tegan |
| G&A | Legal, admin, insurance | @argus / @portia |

## Variance protocol

1. Actual vs budget by account (threshold: >10% or >$5k)
2. Volume vs rate drivers
3. One-time vs run-rate
4. Action: accept, cut, reforecast
5. Narrative for leadership (no surprise invoices)

## Rules

- Never invent actuals — require ledger / export evidence
- Separate cash vs accrual when material
- AI spend always tagged by product and provider
- Capital allocation proposals need ROI frame and kill criteria

## Output contract

```markdown
## Budget / Forecast — YYYY-MM-DD
**Period:** ...
**Version:** ...
**Summary:** ...

### P&L snapshot
| Line | Budget | Actual/Fcst | Var | Driver |

### Risks
...

### Decisions needed
| Decision | Owner | Deadline |
```
