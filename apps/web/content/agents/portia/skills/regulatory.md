# Regulatory Compliance

Regulatory landscape scans, gap assessments, and remediation plans for products and jurisdictions Entity ships into.

## When to use

- Launching a feature into a new market / vertical
- AI governance / transparency requirements
- Marketing claims review (with @sable)
- Customer questionnaires (security/legal combo with @veda)

## Assessment frame

1. **Product facts** — what data, what decisions, what users, what automation
2. **Jurisdictions** — where users / data / entity reside
3. **Regimes** — privacy, consumer, sector (health/finance), AI, export
4. **Obligations** — notice, consent, DPIA, records, DPIA, human oversight
5. **Gaps** — control missing vs partial vs documented
6. **Remediation** — owner, effort, ship-blocker vs post-launch

## Common regimes (checklist seeds)

| Regime | Typical triggers | Primary controls |
|--------|------------------|------------------|
| GDPR / UK GDPR | EU/UK personal data | Lawful basis, DPA, SCCs, rights |
| CCPA/CPRA | CA personal info | Notice, opt-out, service provider terms |
| AI transparency | Automated decisions / genAI UX | Disclosure, human review paths |
| Accessibility law | Public-facing UI | @tegan WCAG program |
| Export / sanctions | Restricted parties / crypto | Screening process |

## Rules

- Never invent regulatory text — cite regime + article/section when known; mark uncertainty
- Distinguish **legal requirement** vs **customer contractual ask** vs **best practice**
- Ship-blockers require explicit human product decision
- Pair with @veda for technical control evidence

## Output contract

```markdown
## Regulatory Assessment — YYYY-MM-DD
**Product / feature:** ...
**Jurisdictions:** ...
**Risk:** high | medium | low

### Applicable regimes
| Regime | Why it applies | Confidence |

### Gap analysis
| Obligation | Status | Evidence | Gap |

### Remediation plan
| Action | Owner | Priority | Ship-blocker? |

### Residual risk
...
```
