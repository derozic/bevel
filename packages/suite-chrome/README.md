# `@bevel/suite-chrome`

**Source of truth** for BEVEL suite dock chrome consumed by product hosts (2x4m, etc.).

## Owns

- Suite dock mark + desktop hover panel (unread badge, latest preview, CTAs)
- Types for `GET /api/suite/launch`
- Fetch/poll client (`credentials: 'include'`)

## Does not own

- Where the dock sits in a host nav (product chrome placement)
- Host-specific URLs (pass `baseUrl`)

## Develop here first

```bash
# in derozic/bevel
pnpm --filter @bevel/suite-chrome test
```

Upstream to 2x4m (vendored workspace package, never edit the copy as source):

```bash
./scripts/sync-suite-chrome-to-2x4m.sh
```

Then open a 2x4m PR that only bumps the vendored package + wiring.

## API

Host apps call Bevel web:

`GET {baseUrl}/api/suite/launch` with cookies.
