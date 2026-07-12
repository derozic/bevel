/**
 * BEVEL feature flags and feature sets.
 *
 * Two axes:
 * 1. **Plan** — free | trial | pro | team | enterprise (commercial tier)
 * 2. **Release access** — stable | beta | upcoming (preview channel)
 *
 * Each flag has minPlan + release. A tenant gets a flag only when both match.
 * Declare plan + feature_access (and optional feature overrides) in bevel.yaml.
 */

import { z } from 'zod'

// ── Plans ───────────────────────────────────────────────────────────────────

export const TenantPlanSchema = z.enum([
  'free',
  'trial',
  'pro',
  'team',
  'enterprise',
])
export type TenantPlan = z.infer<typeof TenantPlanSchema>

/** Ordered rank for comparisons (higher = more capabilities). */
export const PLAN_RANK: Record<TenantPlan, number> = {
  free: 0,
  trial: 1,
  pro: 2,
  team: 3,
  enterprise: 4,
}

/**
 * Trial unlocks the same feature floor as Pro (paid).
 * Team/enterprise still require those plans for higher floors.
 */
export function effectivePlanRank(plan: TenantPlan | string | undefined): number {
  const p = (plan ?? 'free') as TenantPlan
  if (p === 'trial') return PLAN_RANK.pro
  return PLAN_RANK[p] ?? 0
}

export function isPaidPlan(plan: TenantPlan | string | undefined): boolean {
  return effectivePlanRank(plan) >= PLAN_RANK.pro
}

export function isTrialPlan(plan: TenantPlan | string | undefined): boolean {
  return (plan ?? 'free') === 'trial'
}

export const PAID_PLANS: readonly TenantPlan[] = [
  'trial',
  'pro',
  'team',
  'enterprise',
] as const

// ── Release channel (beta / upcoming) ───────────────────────────────────────

/**
 * How far into the release pipeline a customer may see.
 * - stable: GA only (default)
 * - beta: GA + beta
 * - upcoming: GA + beta + upcoming (earliest access)
 */
export const FeatureAccessSchema = z.enum(['stable', 'beta', 'upcoming'])
export type FeatureAccess = z.infer<typeof FeatureAccessSchema>

export const FEATURE_ACCESS_RANK: Record<FeatureAccess, number> = {
  stable: 0,
  beta: 1,
  upcoming: 2,
}

/** Stability of a catalog flag (when it ships relative to GA). */
export type FeatureRelease = FeatureAccess

export function accessIncludesRelease(
  access: FeatureAccess | string | undefined,
  release: FeatureRelease,
): boolean {
  const a = (access ?? 'stable') as FeatureAccess
  const rank = FEATURE_ACCESS_RANK[a] ?? 0
  return rank >= FEATURE_ACCESS_RANK[release]
}

export function isBetaAccess(access: FeatureAccess | string | undefined): boolean {
  return accessIncludesRelease(access, 'beta')
}

export function isUpcomingAccess(
  access: FeatureAccess | string | undefined,
): boolean {
  return accessIncludesRelease(access, 'upcoming')
}

// ── Feature flag catalog ────────────────────────────────────────────────────

/**
 * Stable feature flag ids. Add new product capabilities here first,
 * then wire UI/API gates via hasFeature(tenant, 'flag').
 */
export const FEATURE_FLAG_IDS = [
  // Core (free, stable)
  'channels',
  'directMessages',
  'agentDispatch',
  'asyncStreams',
  'liveSessions',
  'analytics',
  // Paid stable (pro+ / trial)
  'workMode',
  'customBranding',
  'sms',
  'otpSms',
  'presenceSms',
  // Team+
  'liveMedia',
  'ssoSaml',
  // Enterprise+
  'auditLog',
  'dedicatedSupport',
  // Beta / upcoming (still gated by minPlan)
  'agentMemory',
  'voiceRooms',
  'multiRegion',
] as const

export type FeatureFlagId = (typeof FEATURE_FLAG_IDS)[number]

export type FeatureFlagDefinition = {
  id: FeatureFlagId
  /** Human label for admin / docs */
  label: string
  description: string
  /**
   * Minimum plan that includes this flag by default.
   * trial is treated as pro for ranking.
   */
  minPlan: TenantPlan
  /**
   * Release pipeline stage.
   * - stable: GA (default)
   * - beta: needs feature_access >= beta
   * - upcoming: needs feature_access >= upcoming
   */
  release: FeatureRelease
  /** Shown in free upgrade CTAs */
  paidOnly?: boolean
}

function def(
  partial: Omit<FeatureFlagDefinition, 'release'> & {
    release?: FeatureRelease
  },
): FeatureFlagDefinition {
  return { release: 'stable', ...partial }
}

/**
 * Canonical catalog. Order is presentation-friendly (core → paid → enterprise → preview).
 */
export const FEATURE_CATALOG: Record<FeatureFlagId, FeatureFlagDefinition> = {
  channels: def({
    id: 'channels',
    label: 'Channels',
    description: 'Named conversation channels and history',
    minPlan: 'free',
  }),
  directMessages: def({
    id: 'directMessages',
    label: 'Direct messages',
    description: '1:1 and small-group DMs',
    minPlan: 'free',
  }),
  agentDispatch: def({
    id: 'agentDispatch',
    label: 'Agent dispatch',
    description: 'Route work to fleet agents',
    minPlan: 'free',
  }),
  asyncStreams: def({
    id: 'asyncStreams',
    label: 'Async streams',
    description: 'SSE / async stream transport',
    minPlan: 'free',
  }),
  liveSessions: def({
    id: 'liveSessions',
    label: 'Live sessions',
    description: 'Realtime bidirectional sessions',
    minPlan: 'free',
  }),
  analytics: def({
    id: 'analytics',
    label: 'Analytics',
    description: 'Workspace usage analytics',
    minPlan: 'free',
  }),
  workMode: def({
    id: 'workMode',
    label: 'Work mode',
    description: 'GitHub-linked repo write / tickets',
    minPlan: 'pro',
    paidOnly: true,
  }),
  customBranding: def({
    id: 'customBranding',
    label: 'Custom branding',
    description: 'Workspace logos, day-part marks, product name',
    minPlan: 'pro',
    paidOnly: true,
  }),
  sms: def({
    id: 'sms',
    label: 'SMS (Twilio)',
    description: 'Cheap Messages API for OTP + presence (umbrella)',
    minPlan: 'pro',
    paidOnly: true,
  }),
  otpSms: def({
    id: 'otpSms',
    label: 'Mobile OTP sign-in',
    description: 'SMS one-time codes at login',
    minPlan: 'pro',
    paidOnly: true,
  }),
  presenceSms: def({
    id: 'presenceSms',
    label: 'True-sentience SMS',
    description: 'SMS when unread and no desktop/mobile presence',
    minPlan: 'pro',
    paidOnly: true,
  }),
  liveMedia: def({
    id: 'liveMedia',
    label: 'Live media (WebRTC)',
    description: 'Audio/video huddles',
    minPlan: 'team',
    paidOnly: true,
  }),
  ssoSaml: def({
    id: 'ssoSaml',
    label: 'SAML SSO',
    description: 'Enterprise identity provider SSO',
    minPlan: 'team',
    paidOnly: true,
  }),
  auditLog: def({
    id: 'auditLog',
    label: 'Audit log',
    description: 'Immutable admin audit trail',
    minPlan: 'enterprise',
    paidOnly: true,
  }),
  dedicatedSupport: def({
    id: 'dedicatedSupport',
    label: 'Dedicated support',
    description: 'Named support channel and SLAs',
    minPlan: 'enterprise',
    paidOnly: true,
  }),
  // ── Beta ────────────────────────────────────────────────────────────────
  agentMemory: def({
    id: 'agentMemory',
    label: 'Agent memory (beta)',
    description: 'Long-lived agent memory across sessions',
    minPlan: 'pro',
    release: 'beta',
    paidOnly: true,
  }),
  voiceRooms: def({
    id: 'voiceRooms',
    label: 'Voice rooms (beta)',
    description: 'Persistent voice channels alongside text',
    minPlan: 'team',
    release: 'beta',
    paidOnly: true,
  }),
  // ── Upcoming ────────────────────────────────────────────────────────────
  multiRegion: def({
    id: 'multiRegion',
    label: 'Multi-region (upcoming)',
    description: 'Pin realtime + history to a region',
    minPlan: 'enterprise',
    release: 'upcoming',
    paidOnly: true,
  }),
}

// ── Resolution ──────────────────────────────────────────────────────────────

/** Optional per-flag overrides from bevel.yaml (true/false). */
export type FeatureOverrides = Partial<Record<FeatureFlagId, boolean>>

export type ResolvedFeatureSet = Record<FeatureFlagId, boolean> & {
  /** Echo of plan used for resolution */
  _plan: TenantPlan
  /** stable | beta | upcoming */
  _featureAccess: FeatureAccess
  /** True when plan is free */
  _isFree: boolean
  /** True when plan is trial or any paid tier */
  _isPaid: boolean
  /** True when plan is trial */
  _isTrial: boolean
  /** True when beta or upcoming channel is open */
  _hasBeta: boolean
  /** True when upcoming channel is open */
  _hasUpcoming: boolean
}

export function planMeetsMinimum(
  plan: TenantPlan | string | undefined,
  minPlan: TenantPlan,
): boolean {
  return effectivePlanRank(plan) >= PLAN_RANK[minPlan]
}

/** Plan floor AND release channel both required. */
export function flagAvailableFor(
  plan: TenantPlan | string | undefined,
  access: FeatureAccess | string | undefined,
  def: FeatureFlagDefinition,
): boolean {
  return (
    planMeetsMinimum(plan, def.minPlan) &&
    accessIncludesRelease(access, def.release)
  )
}

/**
 * Default enabled map for a plan + release access (no YAML overrides).
 */
export function defaultFeaturesForPlan(
  plan: TenantPlan | string | undefined,
  access: FeatureAccess | string | undefined = 'stable',
): Record<FeatureFlagId, boolean> {
  const out = {} as Record<FeatureFlagId, boolean>
  for (const id of FEATURE_FLAG_IDS) {
    const def = FEATURE_CATALOG[id]
    out[id] = flagAvailableFor(plan, access, def)
  }
  return out
}

/**
 * Merge plan + release access defaults with optional YAML overrides.
 *
 * - Plan floor cannot be escalated (free cannot force SMS)
 * - Release channel cannot be escalated (stable cannot force beta flags)
 * - `false` override always wins (opt-out)
 * - `true` override only if plan + access already qualify
 */
export function resolveFeatureSet(opts: {
  plan?: TenantPlan | string
  /** stable (default) | beta | upcoming */
  featureAccess?: FeatureAccess | string
  overrides?: FeatureOverrides | Record<string, boolean | undefined>
}): ResolvedFeatureSet {
  const plan = (opts.plan ?? 'free') as TenantPlan
  const featureAccess = (opts.featureAccess ?? 'stable') as FeatureAccess
  const base = defaultFeaturesForPlan(plan, featureAccess)
  const overrides = opts.overrides ?? {}

  for (const id of FEATURE_FLAG_IDS) {
    const raw = overrides[id]
    if (raw === undefined) continue
    if (raw === false) {
      base[id] = false
      continue
    }
    if (flagAvailableFor(plan, featureAccess, FEATURE_CATALOG[id])) {
      base[id] = true
    }
  }

  // sms umbrella: if sms is off, force otpSms + presenceSms off
  if (!base.sms) {
    base.otpSms = false
    base.presenceSms = false
  }
  // if either child is on, sms umbrella is on (when plan + access allow)
  if (
    (base.otpSms || base.presenceSms) &&
    flagAvailableFor(plan, featureAccess, FEATURE_CATALOG.sms)
  ) {
    base.sms = true
  }

  const resolvedPlan = plan in PLAN_RANK ? plan : 'free'
  const resolvedAccess =
    featureAccess in FEATURE_ACCESS_RANK ? featureAccess : 'stable'

  return {
    ...base,
    _plan: resolvedPlan,
    _featureAccess: resolvedAccess,
    _isFree: resolvedPlan === 'free',
    _isPaid: isPaidPlan(resolvedPlan),
    _isTrial: isTrialPlan(resolvedPlan),
    _hasBeta: isBetaAccess(resolvedAccess),
    _hasUpcoming: isUpcomingAccess(resolvedAccess),
  }
}

export type FeatureTenantLike = {
  plan?: TenantPlan | string
  featureAccess?: FeatureAccess | string
  features?: FeatureOverrides & Record<string, boolean | undefined>
  /** Pre-resolved set from loader (preferred). */
  featureSet?: ResolvedFeatureSet
}

/**
 * Runtime check. Prefer tenant.featureSet when present (from loader).
 */
export function hasFeature(
  tenant: FeatureTenantLike | null | undefined,
  flag: FeatureFlagId,
): boolean {
  if (!tenant) return false
  if (tenant.featureSet) return Boolean(tenant.featureSet[flag])
  const resolved = resolveFeatureSet({
    plan: tenant.plan,
    featureAccess: tenant.featureAccess,
    overrides: tenant.features as FeatureOverrides,
  })
  return Boolean(resolved[flag])
}

/** SMS umbrella (OTP + presence). */
export function tenantHasSms(
  tenant: FeatureTenantLike | null | undefined,
): boolean {
  return hasFeature(tenant, 'sms')
}

/** Flags locked by plan (ignore release channel). */
export function lockedFeaturesForPlan(
  plan: TenantPlan | string | undefined,
): FeatureFlagDefinition[] {
  return FEATURE_FLAG_IDS.map((id) => FEATURE_CATALOG[id]).filter(
    (def) => !planMeetsMinimum(plan, def.minPlan),
  )
}

/** Flags the tenant’s plan qualifies for but release access blocks (beta/upcoming). */
export function lockedFeaturesForAccess(
  plan: TenantPlan | string | undefined,
  access: FeatureAccess | string | undefined,
): FeatureFlagDefinition[] {
  return FEATURE_FLAG_IDS.map((id) => FEATURE_CATALOG[id]).filter(
    (def) =>
      planMeetsMinimum(plan, def.minPlan) &&
      !accessIncludesRelease(access, def.release),
  )
}

/** All beta + upcoming flags (for admin lists). */
export function previewFlags(
  release: FeatureRelease | 'preview' = 'preview',
): FeatureFlagDefinition[] {
  return FEATURE_FLAG_IDS.map((id) => FEATURE_CATALOG[id]).filter((def) => {
    if (release === 'preview') return def.release !== 'stable'
    return def.release === release
  })
}

/** CamelCase runtime features object (legacy Tenant.features shape). */
export function toLegacyFeaturesObject(
  set: ResolvedFeatureSet,
): {
  channels: boolean
  directMessages: boolean
  agentDispatch: boolean
  workMode: boolean
  customBranding: boolean
  sms: boolean
  asyncStreams: boolean
  liveSessions: boolean
  analytics: boolean
  liveMedia: boolean
  otpSms: boolean
  presenceSms: boolean
  agentMemory: boolean
  voiceRooms: boolean
  multiRegion: boolean
} {
  return {
    channels: set.channels,
    directMessages: set.directMessages,
    agentDispatch: set.agentDispatch,
    workMode: set.workMode,
    customBranding: set.customBranding,
    sms: set.sms,
    asyncStreams: set.asyncStreams,
    liveSessions: set.liveSessions,
    analytics: set.analytics,
    liveMedia: set.liveMedia,
    otpSms: set.otpSms,
    presenceSms: set.presenceSms,
    agentMemory: set.agentMemory,
    voiceRooms: set.voiceRooms,
    multiRegion: set.multiRegion,
  }
}

