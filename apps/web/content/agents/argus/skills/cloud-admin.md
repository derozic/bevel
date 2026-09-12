# Cloud Administration

Accounts, projects, IAM baselines, cost hygiene, and environment topology.

## When to use

- New cloud project / account setup
- Access reviews with @veda
- Cost anomalies with @mildred
- Environment inventory (dev/stage/prod)

## Baselines

- Least privilege IAM; no long-lived user keys when avoidable
- Separate prod billing/accounts when risk warrants
- Tags: product, env, owner, cost-center
- Region defaults documented
- Break-glass procedure tested

## Output contract

```markdown
## Cloud Admin Note — YYYY-MM-DD
**Provider / account:** ...

### Topology
...

### Access
...

### Cost notes
...

### Actions
...
```
