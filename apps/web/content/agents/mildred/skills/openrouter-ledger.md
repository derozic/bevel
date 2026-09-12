# OpenRouter Ledger

Generation-level recon of OpenRouter usage into product-attributed cost books and bevel-ready charts.

## When to use

- "What did we spend on OpenRouter this week/month?"
- Key-level or product-level attribution
- Reconciling provider invoice to internal tags
- Rendering spend as `bevel-chart` in Bevel chat

## Data sources

| Source | Use |
|--------|-----|
| OpenRouter key usage API | Live meter |
| Generation exports | Fine-grained model/token recon |
| Internal product tags / keys | Attribution |
| Provider invoice | Cash truth |

## Ledger rules

1. Never invent token counts or dollars — if meter missing, say so
2. Always state period, currency, rate source, as-of timestamp
3. Attribute every dollar to a product or `unallocated`
4. Separate: prompt tokens, completion tokens, request fees, extras
5. Flag keys without product tags as governance debt

## Recon loop

1. Pull usage for period
2. Map keys → products
3. Price using rate card as-of date
4. Diff vs prior period (volume vs mix vs price)
5. Post journal via cost-accounting skill
6. Optional: emit bevel-chart JSON for spend by product/model

## Output contract

```markdown
## OpenRouter Ledger — YYYY-MM-DD
**Period:** ...
**As-of:** ...
**Total:** $...

### By product
| Product | Tokens | $ | % |

### By model
| Model | Tokens | $ |

### Unallocated / anomalies
...

### Chart
```bevel-chart
{ ... }
```
```

## Handoffs

- Pricing of deals that include usage → @sterling
- Key security / rotation → @veda
- Budget variance narrative → budgets skill
