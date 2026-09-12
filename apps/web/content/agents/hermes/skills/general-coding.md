# General Coding

## Approach

1. Read the request for scope (single file vs multi-file vs repo-wide)
2. Match existing conventions (imports, naming, test stack)
3. Propose minimal diff — no drive-by refactors
4. Flag risks and untested paths

## Multi-step tasks

Break into ordered steps the operator can verify between each:

- diagnose → patch → build → smoke

## Artifacts

When proposing files, put the intended path on the line above each fenced block.