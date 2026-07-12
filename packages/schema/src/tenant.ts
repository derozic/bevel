import { z } from 'zod'
import {
  resolveFeatureSet,
  TenantPlanSchema,
  FeatureAccessSchema,
  type FeatureFlagId,
  type ResolvedFeatureSet,
  type TenantPlan,
  type FeatureAccess,
} from './featuresets'

export {
  TenantPlanSchema,
  FeatureAccessSchema,
  PLAN_RANK,
  FEATURE_ACCESS_RANK,
  PAID_PLANS,
  FEATURE_FLAG_IDS,
  FEATURE_CATALOG,
  defaultFeaturesForPlan,
  resolveFeatureSet,
  hasFeature,
  tenantHasSms,
  isPaidPlan,
  isTrialPlan,
  isBetaAccess,
  isUpcomingAccess,
  accessIncludesRelease,
  planMeetsMinimum,
  flagAvailableFor,
  lockedFeaturesForPlan,
  lockedFeaturesForAccess,
  previewFlags,
  toLegacyFeaturesObject,
  effectivePlanRank,
  type TenantPlan,
  type FeatureAccess,
  type FeatureRelease,
  type FeatureFlagId,
  type FeatureFlagDefinition,
  type FeatureOverrides,
  type ResolvedFeatureSet,
  type FeatureTenantLike,
} from './featuresets'

export const TenantAuthPolicySchema = z.object({
  providers: z.array(z.enum(['google', 'github', 'credentials'])).default(['google']),
  allowedEmailDomains: z.array(z.string()).optional(),
  allowedEmails: z.array(z.string().email()).optional(),
  /** Domains that route to this tenant first after platform (bevel.lvh.me) login. */
  defaultForDomains: z.array(z.string()).optional(),
  requireGitHubForWork: z.boolean().default(false),
})

/**
 * Runtime feature map (camelCase). Resolved from plan + YAML overrides
 * via resolveFeatureSet — do not treat as free-form arbitrary keys.
 */
export const TenantFeaturesSchema = z.object({
  channels: z.boolean().default(true),
  directMessages: z.boolean().default(true),
  agentDispatch: z.boolean().default(true),
  workMode: z.boolean().default(false),
  customBranding: z.boolean().default(false),
  sms: z.boolean().default(false),
  otpSms: z.boolean().default(false),
  presenceSms: z.boolean().default(false),
  asyncStreams: z.boolean().default(true),
  liveSessions: z.boolean().default(true),
  analytics: z.boolean().default(true),
  liveMedia: z.boolean().default(false),
  ssoSaml: z.boolean().default(false),
  auditLog: z.boolean().default(false),
  dedicatedSupport: z.boolean().default(false),
  agentMemory: z.boolean().default(false),
  voiceRooms: z.boolean().default(false),
  multiRegion: z.boolean().default(false),
})

const logoPathSchema = z
  .string()
  .refine((v) => v.startsWith('/') || /^https?:\/\//i.test(v), {
    message: 'logo path must be a path or http(s) URL',
  })

/** Four day-part marks — morning / midday / afternoon / night */
export const DaypartLogoUrlsSchema = z.object({
  morning: logoPathSchema.optional(),
  midday: logoPathSchema.optional(),
  afternoon: logoPathSchema.optional(),
  night: logoPathSchema.optional(),
})

export type DaypartLogoUrls = z.infer<typeof DaypartLogoUrlsSchema>

export const TenantThemeSchema = z.object({
  accent: z.string().default('#7c5cff'),
  background: z.string().optional(),
  surface: z.string().optional(),
  surfaceRaised: z.string().optional(),
  text: z.string().optional(),
  textMuted: z.string().optional(),
  border: z.string().optional(),
  fontSans: z.string().optional(),
  mode: z.enum(['light', 'dark']).default('dark'),
  /** Absolute URL or site-relative path (/brand/{slug}/logo.svg) — default fallback */
  logoUrl: logoPathSchema.optional(),
  markUrl: logoPathSchema.optional(),
  /**
   * Day-part specific workspace marks (left of product name).
   * Missing parts fall back to logoUrl / markUrl.
   */
  logoUrlsByDaypart: DaypartLogoUrlsSchema.optional(),
  productName: z.string().optional(),
})

export const TenantRealtimeSchema = z.object({
  namespace: z.string().min(1),
  url: z.string().url().optional(),
})

export const TenantSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  host: z.string().min(1),
  status: z.enum(['active', 'pending', 'suspended']).default('active'),
  /** free | trial | pro | team | enterprise */
  plan: TenantPlanSchema.default('free'),
  /**
   * How far into the release pipeline this workspace may go:
   * stable (GA only) | beta | upcoming
   */
  featureAccess: FeatureAccessSchema.default('stable'),
  /**
   * Optional trial window (ISO). When plan is trial and trialEndsAt is past,
   * callers should treat as free — loader can flip plan at resolve time.
   */
  trialEndsAt: z.string().datetime().optional(),
  auth: TenantAuthPolicySchema.default({}),
  features: TenantFeaturesSchema.default({}),
  /**
   * Full resolved feature set including meta (_plan, _featureAccess, _hasBeta, …).
   * Prefer hasFeature(tenant, id) over reading features alone.
   */
  featureSet: z.custom<ResolvedFeatureSet>().optional(),
  theme: TenantThemeSchema.default({}),
  realtime: TenantRealtimeSchema,
  workRepos: z.array(z.string()).default([]),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})

export type Tenant = z.infer<typeof TenantSchema>
export type TenantAuthPolicy = z.infer<typeof TenantAuthPolicySchema>
export type TenantFeatures = z.infer<typeof TenantFeaturesSchema>
export type TenantTheme = z.infer<typeof TenantThemeSchema>
export type TenantRealtime = z.infer<typeof TenantRealtimeSchema>

/** Ensure featureSet is populated (e.g. after parse). */
export function withResolvedFeatures(tenant: Tenant): Tenant {
  if (tenant.featureSet) return tenant
  let plan = tenant.plan ?? 'free'
  if (
    plan === 'trial' &&
    tenant.trialEndsAt &&
    new Date(tenant.trialEndsAt).getTime() < Date.now()
  ) {
    plan = 'free'
  }
  const featureAccess = tenant.featureAccess ?? 'stable'
  const featureSet = resolveFeatureSet({
    plan,
    featureAccess,
    overrides: tenant.features as Partial<Record<FeatureFlagId, boolean>>,
  })
  return {
    ...tenant,
    plan,
    featureAccess,
    features: {
      channels: featureSet.channels,
      directMessages: featureSet.directMessages,
      agentDispatch: featureSet.agentDispatch,
      workMode: featureSet.workMode,
      customBranding: featureSet.customBranding,
      sms: featureSet.sms,
      otpSms: featureSet.otpSms,
      presenceSms: featureSet.presenceSms,
      asyncStreams: featureSet.asyncStreams,
      liveSessions: featureSet.liveSessions,
      analytics: featureSet.analytics,
      liveMedia: featureSet.liveMedia,
      ssoSaml: featureSet.ssoSaml,
      auditLog: featureSet.auditLog,
      dedicatedSupport: featureSet.dedicatedSupport,
      agentMemory: featureSet.agentMemory,
      voiceRooms: featureSet.voiceRooms,
      multiRegion: featureSet.multiRegion,
    },
    featureSet,
  }
}
