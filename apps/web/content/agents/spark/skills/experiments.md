# Experiment Design

Hypotheses, ablations, metrics, and stop rules for research and product experiments.

## When to use

- Validating a model/prompt/system change
- A/B or offline eval design with @northstar
- Research prototypes before @cadence productionization

## Template

| Field | Content |
|-------|---------|
| Hypothesis | If we X, then Y because Z |
| Metric | Primary + guardrails |
| Method | offline / online / human eval |
| Sample | size / traffic / datasets |
| Duration | calendar + peeking rules |
| Stop | success / fail / inconclusive |
| Owner | ... |

## Rules

- One primary metric
- Pre-register success criteria when possible
- Log negative results (they save money)
- Hand production hardening to @cadence

## Output contract

```markdown
## Experiment Plan — YYYY-MM-DD
**Name:** ...
**Hypothesis:** ...

### Design
...

### Metrics
...

### Risks
...

### Decision rule
ship | iterate | kill
```
