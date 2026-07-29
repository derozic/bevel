export {
  createTenantAuthConfig,
  homePathForTenant,
  isAllowedAuthRedirectHostname,
  isGoogleAuthConfigured,
  isGitHubAuthConfigured,
  isOtpAuthEnabled,
  phoneOtpAllowedOnTenant,
  resolveOAuthSignInOrigin,
  tenantHasClosedMembership,
  type CreateTenantAuthConfigOptions,
} from './config'
export { mintApiToken, mintRealtimeToken, resolveAuthSecret } from './tokens'
export {
  issueOtp,
  verifyOtpCode,
  checkOtpSendRateLimit,
  phoneToSyntheticEmail,
  isPhoneSyntheticEmail,
  type OtpChannel,
  type OtpRateLimitResult,
} from './otp'
export { AuthProvider } from './client'
import './types'