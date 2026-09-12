# Intellectual Property

Patent strategy signals, trademarks, copyright hygiene, OSS compliance, and IP ownership in commercial deals.

## When to use

- Naming / branding clearance (high-level)
- OSS license review for shipping code
- Invention capture / patent vs trade secret decision framing
- Customer IP assignment clauses
- Contributor / contractor IP assignment gaps

## Ownership defaults (Entity preference)

| Asset | Prefer |
|-------|--------|
| Product code & models we train | Entity owns |
| Customer data | Customer owns; we get processing rights |
| Feedback / suggestions | License to Entity without obligation |
| Joint deliverables | Explicit schedule; avoid ambiguous "joint own all" |
| Contractors | Work-for-hire + assignment signed before access |

## OSS risk tiers

| License family | Ship-in-product risk | Notes |
|----------------|----------------------|-------|
| MIT / Apache-2.0 / BSD | Low | Preserve notices |
| MPL | Medium | File-level copyleft |
| LGPL | Medium–High | Dynamic linking care |
| GPL / AGPL | High | Product architecture review required |
| Proprietary / unknown | High | Do not ship |

## Invention triage

1. What problem does it solve uniquely?
2. Is it detectable in a product / API?
3. Trade secret viable (and keepable)?
4. Freedom-to-operate concerns? → research + counsel
5. Filing deadline / public disclosure clock

## Output contract

```markdown
## IP Assessment — YYYY-MM-DD
**Matter:** ...
**Risk:** high | medium | low

### Assets in scope
...

### Ownership map
| Asset | Owner | Gap |

### OSS findings
| Package | License | Action |

### Recommendations
1. ...

### Outside counsel?
yes | no — why
```
