# Roadmap Architecture

Theme-based, capacity-aware roadmaps with clear sequencing and tradeoffs.

## When to use

- Quarterly roadmap drafts
- Re-prioritization after incidents or market shifts
- Capacity negotiation with @cadence

## Structure

1. **Themes** (3–5 max) not a laundry list
2. **Now / Next / Later** with exit criteria
3. **Dependencies** (design, legal, security, partners)
4. **Capacity** honest about eng weeks
5. **Risks** and what we are not doing

## Anti-patterns

- Roadmap as stakeholder parking lot
- Dates without capacity
- Features without success metrics
- Silent dependencies on Portia/Veda/Grover

## Output contract

```markdown
## Roadmap — YYYY-MM-DD
**Period:** ...

### Themes
...

### Now
| Item | Outcome | Owner | Depends |

### Next / Later
...

### Explicit cuts
...
```
