export {
  createTenantAuthConfig,
  homePathForTenant,
  isGoogleAuthConfigured,
  isGitHubAuthConfigured,
  isOtpAuthEnabled,
  phoneOtpAllowedOnTenant,
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