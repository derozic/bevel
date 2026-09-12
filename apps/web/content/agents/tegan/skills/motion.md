# Motion & Interaction

Purposeful animation: enter/exit, feedback, and transitions that communicate state.

## When to use

- Microinteractions, page transitions, loading
- Reducing motion / vestibular safety
- Motion tokens in design system

## Principles

1. **Meaning first** — motion explains state change
2. **Short** — prefer 150–300ms UI; longer only for narrative
3. **Interruptible** — respect `prefers-reduced-motion`
4. **One hero motion** per view max
5. **No novelty for its own sake**

## Output contract

```markdown
## Motion Spec — YYYY-MM-DD
**Component / flow:** ...

### States
idle → hover → active → success/error

### Timing / easing
...

### Reduced motion fallback
...
```
