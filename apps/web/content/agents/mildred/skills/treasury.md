# Treasury & Cash

Cash position, runway, payment timing, prepaid balances, and refund reconciliation.

## When to use

- Runway / cash snapshot
- Payment terms risk on large deals
- Prepaid credit (OpenRouter / cloud) tracking
- Refunds, chargebacks, failed payments

## Core views

| View | Definition |
|------|------------|
| Cash on hand | Bank + clearable |
| Restricted | Escrow, deposits |
| Prepaid assets | Provider credits remaining |
| Near-term outflows | 30/60/90 day obligations |
| Runway | Cash / net burn (state assumptions) |

## Controls

- Dual control on large outflows (policy threshold)
- No payment > net-60 without treasury note
- Match refunds to original invoice / usage period
- Flag currency exposure if multi-currency material

## Output contract

```markdown
## Treasury Snapshot — YYYY-MM-DD
**As-of:** ...
**Cash:** $
**Runway:** Xm (assumptions: ...)

### Prepaid / credits
| Provider | Balance | Burn rate |

### 90-day obligations
...

### Alerts
...
```
