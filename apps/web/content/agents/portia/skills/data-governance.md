# Data Governance

Data handling policies, retention, processing records, privacy frameworks, and cross-border transfer patterns.

## When to use

- Data inventory / RoPA-style records
- Retention schedule design
- Sub-processor / vendor data review
- Privacy policy / notice updates (content structure)
- Customer DPA schedules (data categories, purposes)

## Data classes

| Class | Examples | Default handling |
|-------|----------|------------------|
| Public | Marketing site copy | Open |
| Internal | Roadmaps, metrics | Need-to-know |
| Confidential | Contracts, finances | Access-controlled |
| Personal | Emails, names, IDs | Privacy program |
| Sensitive personal | Auth factors, precise location | Minimize + extra controls |
| Secrets | API keys, tokens | @veda secrets program — never in tickets |

## Retention defaults (starting point — confirm per product)

| Data type | Retain | Delete / anonymize |
|-----------|--------|---------------------|
| Auth logs | 90 days | Auto |
| Product telemetry (non-PII) | 13 months | Aggregate |
| Support tickets | 24 months | Ticket lifecycle |
| Contracts | Term + 7 years | Legal hold exceptions |
| Backups | Rolling 30–90 days | Crypto-shred if needed |

## Transfer & vendors

- Prefer regional processing when promised
- SCCs / DPAs for restricted transfers
- Sub-processor list currency; notify path for changes
- No shadow SaaS — @argus vendor process

## Output contract

```markdown
## Data Governance Note — YYYY-MM-DD
**System / product:** ...
**Summary:** ...

### Data map
| Category | Source | Purpose | Lawful basis / contract | Retention |

### Transfers
| From → To | Mechanism |

### Gaps
1. ...

### Policy updates needed
- ...

### Handoffs
- @veda — technical enforcement
- @argus — vendor inventory
```
