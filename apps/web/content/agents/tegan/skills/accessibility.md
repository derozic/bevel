# Accessibility (WCAG 2.2)

Organizational accessibility floor for UI craft and reviews.

## When to use

- PR design reviews
- New component patterns
- Audits before launch

## Non-negotiables

| Area | Bar |
|------|-----|
| Contrast | Text/UI components meet AA |
| Focus | Visible focus; logical order |
| Semantics | Correct headings, labels, landmarks |
| Keyboard | All actions operable |
| Motion | Prefer reduced-motion paths |
| Name/role/value | Assistive tech exposed |

## Review method

1. Keyboard-only pass
2. Contrast check on changed UI
3. Screen-reader labels on controls
4. Error identification and suggestions
5. Document residual risk

## Output contract

```markdown
## A11y Review — YYYY-MM-DD
**Scope:** files / flows

### Blocking
1. ...

### Should-fix
...

### Pass notes
...
```
