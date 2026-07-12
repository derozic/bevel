export {
  getTenantFromRequest,
  requireTenantFromRequest,
  getTenantFromSlug,
  TENANT_HEADER,
  TENANT_HOST_HEADER,
} from './server'
export {
  isPaidPlan,
  isTrialPlan,
  isBetaAccess,
  isUpcomingAccess,
  tenantHasSms,
  hasFeature,
  resolveFeatureSet,
  defaultFeaturesForPlan,
  lockedFeaturesForPlan,
  lockedFeaturesForAccess,
  previewFlags,
  flagAvailableFor,
  accessIncludesRelease,
  FEATURE_CATALOG,
  FEATURE_FLAG_IDS,
  PAID_PLANS,
  PLAN_RANK,
  FEATURE_ACCESS_RANK,
  type TenantPlan,
  type FeatureAccess,
  type FeatureRelease,
  type FeatureFlagId,
  type ResolvedFeatureSet,
} from '@bevel/schema'
export {
  withTenantResolution,
  isPlatformHost as isPlatformHostEdge,
  type TenantMiddlewareOptions,
} from './middleware'
export {
  lookupTenantByHost,
  lookupTenantBySlug,
  listTenants,
  lookupTenantsByEmailDomain,
  resolveWorkspacesForEmail,
  resolveHomeTenantForEmail,
  publicTenantUrl,
  isPlatformHost,
  isPlatformEntryHost,
  refreshTenantRegistry,
} from './registry'
export { PLATFORM_ENTRY_HOSTS, PLATFORM_HOSTS } from './constants'
export {
  loadDeclarativeTenant,
  loadCompiledTenant,
  loadThemeTokens,
  compileTenant,
  listTenantSlugs,
  resolveTenantsRoot,
  tenantConfigPath,
} from './loader'
export { runDoctor, formatDoctorReport, type DoctorOptions } from './doctor'
export { tenantThemeCssVars } from './theme-vars'
export {
  provisionTenant,
  slugifyOrgName,
  isValidTenantSlug,
  claimHostForSlug,
  RESERVED_TENANT_SLUGS,
  type ProvisionTenantInput,
  type ProvisionTenantResult,
} from './provision'