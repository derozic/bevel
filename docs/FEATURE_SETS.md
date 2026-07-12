# BEVEL feature flags & feature sets

Two independent axes control what a customer gets:

| Axis | Values | Meaning |
|------|--------|---------|
| **Plan** | `free` · `trial` · `pro` · `team` · `enterprise` | Commercial tier |
| **Feature access** | `stable` · `beta` · `upcoming` | How early they see unreleased work |

A flag is on only when **both** pass: plan ≥ `minPlan` **and** feature access ≥ flag `release`.

Runtime: `hasFeature(tenant, flag)` · catalog: `packages/schema/src/featuresets.ts`.

## Plans

| Plan | Rank | Intent |
|------|------|--------|
| `free` | 0 | Core product only |
| `trial` | → pro | Paid capabilities, time-limited |
| `pro` | 2 | Paid starter |
| `team` | 3 | Collab / SSO / live media |
| `enterprise` | 4 | Audit log, multi-region, dedicated support |

## Feature access (beta / upcoming)

| Access | Sees |
|--------|------|
| `stable` (default) | GA flags only |
| `beta` | GA + **beta** flags |
| `upcoming` | GA + beta + **upcoming** flags |

This is **orthogonal to plan**. Examples:

- `plan: free` + `feature_access: beta` → still no SMS (plan floor)
- `plan: pro` + `feature_access: stable` → paid GA, no beta
- `plan: pro` + `feature_access: beta` → paid GA + beta (e.g. agent memory)
- `plan: enterprise` + `feature_access: upcoming` → everything including earliest previews

## Catalog (selection)

| Flag | Min plan | Release |
|------|----------|---------|
| `channels`, `directMessages`, … | free | stable |
| `workMode`, `customBranding`, `sms`, … | pro | stable |
| `liveMedia`, `ssoSaml` | team | stable |
| `auditLog`, `dedicatedSupport` | enterprise | stable |
| `agentMemory` | pro | **beta** |
| `voiceRooms` | team | **beta** |
| `multiRegion` | enterprise | **upcoming** |

## Declare on a tenant

```yaml
# tenants/acme/bevel.yaml
plan: pro
feature_access: beta          # stable | beta | upcoming
trial_ends_at: "2026-08-01T00:00:00.000Z"   # if plan: trial

features:
  # omit = inherit plan + access defaults
  work_mode: true
  sms: true
  presence_sms: false
  agent_memory: true          # only if feature_access ≥ beta and plan ≥ pro
  multi_region: true          # only if feature_access ≥ upcoming and plan ≥ enterprise
```

Overrides:

- `false` → always off  
- `true` → on **only if** plan + feature_access already qualify (cannot escalate)

## Runtime API

```ts
import {
  hasFeature,
  resolveFeatureSet,
  previewFlags,
  lockedFeaturesForAccess,
  FEATURE_CATALOG,
} from '@bevel/schema'

hasFeature(tenant, 'sms')
hasFeature(tenant, 'agentMemory')      // needs beta access + pro

// What this customer is missing only because of release channel:
lockedFeaturesForAccess(tenant.plan, tenant.featureAccess)

// All non-GA flags in the catalog:
previewFlags('beta')
previewFlags('upcoming')
previewFlags() // both

const set = resolveFeatureSet({
  plan: 'pro',
  featureAccess: 'beta',
  overrides: { presenceSms: false },
})
// set._hasBeta, set._hasUpcoming, set._featureAccess
```

Loader sets `tenant.plan`, `tenant.featureAccess`, `tenant.features`, `tenant.featureSet`.

## Adding a flag

1. Add to `FEATURE_FLAG_IDS` + `FEATURE_CATALOG` with `minPlan` and `release`
2. Map snake_case in `loader.ts` if YAML-exposed
3. Gate with `hasFeature(tenant, 'yourFlag')`
4. Document here

### Choosing `release`

| Use | When |
|-----|------|
| `stable` | GA, all customers on that plan |
| `beta` | In testing with design partners / paid beta cohort |
| `upcoming` | Internal / design-partner earliest access only |

## HTTP

Paid SMS endpoints return **402** + `upgradeRequired` when plan is free (or SMS flag off).
Beta-only routes should return **403** / hide UI when `!hasFeature(tenant, 'agentMemory')`.

## UI visibility

`FeatureFlagsBar` shows plan + access + active paid/preview flag chips:

| Surface | Where |
|---------|--------|
| Marketing / home footer | `SiteFooter` |
| Workspace rail | `BevelRail` footer (compact) |
| Preferences save footer | compact chips |
| `<html>` | `data-tenant-plan`, `data-feature-access` |

Example chips: `plan:pro` · `access:beta` · `sms` · `agentMemory·beta`
