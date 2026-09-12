# Contracts

Contract review, drafting support, negotiation positions, and template hygiene for Entity commercial and vendor agreements.

## When to use

- Customer MSA / order form / DPA review or draft
- Vendor / partner agreements
- NDA, pilot, SOW, marketplace terms
- Redline strategy and fallback positions

## Review protocol

1. **Identify parties, governing law, term, termination**
2. **Map commercial reality** — does paper match the deal Sterling sold?
3. **Flag risk** by severity (blocking / negotiable / accept)
4. **Propose alternative language** (never only "delete this")
5. **List open questions** for business owner
6. **Hand off** security annexes to @veda; pricing math to @mildred / @sterling

## Clause checklist (commercial)

| Clause | Prefer | Escalate if |
|--------|--------|-------------|
| Liability cap | Fees paid in 12 months | Unlimited / fees × unlimited |
| Indemnity | IP + data breach mutual, capped | Broad "all claims" uncapped |
| IP ownership | We own our IP + deliverables we create | Customer owns pre-existing IP |
| Confidentiality | 3–5 years; carve-outs standard | Perpetual + no residuals |
| Data / DPA | Separate DPA; SCCs if needed | Silent on sub-processors |
| Auto-renew | Opt-out window clear | Evergreen without notice |
| Publicity | Logo with approval | Forced case study |
| Assignment | To affiliate / acquirer OK | Free assignment to competitor |
| SLA credits | Sole remedy for uptime | Unlimited consequential |
| Non-solicit | Narrow, time-boxed | Broad employee ban |

## Risk markers (use in output)

- **Blocking** — do not sign without change
- **Material** — negotiate hard; business may accept with eyes open
- **Minor** — clean up if cheap; else accept
- **Business decision** — not legal; Sterling/Helm/Mildred must choose

## Not legal advice disclaimer

Outputs are operational legal analysis for internal decision-making. Final execution authority stays with authorized humans. Flag when outside counsel is required (novel jurisdiction, litigation, M&A, regulated claims).

## Output contract

```markdown
## Contract Review — YYYY-MM-DD
**Matter:** <counterparty + agreement type>
**Status:** draft | review | final
**Risk level:** high | medium | low
**Summary:** <2-3 sentences>

### Blocking issues
1. [Clause X] — problem → proposed language

### Material issues
1. ...

### Acceptable as-is
- ...

### Business decisions needed
| Topic | Options | Owner |

### Handoffs
- @sterling — commercial terms
- @veda — security / SOC exhibits
- @mildred — payment / tax
```
