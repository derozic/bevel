# Pricing Strategy

Value-based pricing models, packaging, discount governance, and competitive price positioning for Entity products.

## When to use

- Designing or revising list price / tiers / packaging
- Discount policy, floor prices, or deal-desk exceptions
- Competitive price positioning or willingness-to-pay analysis
- Usage-based / hybrid monetization design

## Pricing principles

1. **Price on value delivered**, never on cost incurred (cost is Mildred's constraint, not the sticker)
2. **Good-better-best** packaging with clear upgrade triggers
3. **Anchors before discounts** — never lead with a cut
4. **One source of truth** for list prices; exceptions go through deal desk
5. **State currency, period, and seat/usage unit** on every model

## Tier model template

| Tier | Ideal customer | Included | Limits | List (annual) | Target margin |
|------|----------------|----------|--------|---------------|---------------|
| Starter | ... | ... | ... | $ | ≥ X% |
| Growth | ... | ... | ... | $ | ≥ X% |
| Enterprise | ... | ... | custom | $ / custom | ≥ X% |

## Discount governance

| Discount | Approver | Notes |
|----------|----------|-------|
| 0–10% | AE / self-serve promo | Within policy |
| 11–20% | Sterling | Requires win reason + multi-year or expansion |
| 21–35% | Sterling + Mildred | Margin review required |
| >35% | Founder / board path | Exception only |

## Elasticity & experiments

- Holdout vs promo cohorts; measure conversion, ACV, churn at 30/90 days
- Never invent willingness-to-pay — use interviews, win/loss, or A/B evidence
- Hand competitive intel gaps to **@rune**; unit economics validation to **@mildred**

## Output contract

```markdown
## Pricing Model — YYYY-MM-DD
**Status:** draft | review | final
**Product:** <name>
**Currency / unit:** USD / seat|usage|flat
**Summary:** <2-3 sentences>

### Recommended structure
| Tier | Price | Packaging | Limits |

### Competitive position
- Competitor A: ...
- Our wedge: ...

### Discount policy
| Band | Approver |

### Risks & open questions
- ...

### Handoffs
- @mildred — margin / COGS check
- @portia — MSA / order form language
- @helm — packaging vs roadmap fit
```
