# Design tree mapping

Supporting skill for Crucible's interview protocol.

## What a design tree is

A **design tree** is the dependency graph of decisions for a plan:

- Root: the outcome or change being considered
- Nodes: decisions (scope, audience, constraints, approach, non-goals, success criteria, risks)
- Edges: "this decision depends on that one being settled first"

The **frontier** is the set of unsettled nodes whose parents are settled.

## How to build it (mental model)

1. Restate the root goal in one sentence
2. List the first-order decisions that must be true for that goal (initial frontier)
3. For each answer, add child decisions that only make sense after that answer
4. Never ask a child before its parent is settled
5. Mark explicit non-goals as settled leaves (they prune branches)

## Round discipline

| Round state | Action |
|---|---|
| Frontier non-empty | Ask all frontier questions with recommendations; wait |
| User answered | Settle nodes; expand children; recompute frontier |
| Fact needed | Resolve fact (or park as fact-task); only block dependent questions |
| Frontier empty | Produce alignment brief; request confirmation |

## Alignment brief checklist

- Shared understanding summary (2-4 sentences)
- Settled decisions (bullets)
- Explicit non-goals
- Acknowledged risks (accepted, not ignored)
- Suggested next owner (@hermes or director)
- Confirmation question before any implementation
