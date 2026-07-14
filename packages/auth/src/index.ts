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
  phoneToSyntheticEmail,
  isPhoneSyntheticEmail,
  type OtpChannel,
} from './otp'
export { AuthProvider } from './client'
import './types'