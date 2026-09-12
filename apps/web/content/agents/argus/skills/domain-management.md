# Domain & Identity Surfaces

DNS domains, email domains, and public identity assets inventory.

## When to use

- New domain registration / DNS changes
- Subdomain conventions for products
- Preventing domain sprawl / expiry risk

## Rules

- Inventory registrar + DNS host + owner + renewal date
- Prefer centralized DNS where possible
- TLS via Caddy in local/prod standards
- No random domains without Argus record
- Security DNS (SPF/DKIM/DMARC) with @veda

## Output contract

```markdown
## Domain Note — YYYY-MM-DD
**Domain:** ...
**Purpose:** ...
**DNS / registrar:** ...
**Renewal:** ...
**Owner:** ...
```
