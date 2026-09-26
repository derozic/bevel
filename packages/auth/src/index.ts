export {
  createTenantAuthConfig,
  homePathForTenant,
  is2x4mSuiteHost,
  isGoogleAuthConfigured,
  isGitHubAuthConfigured,
  isOtpAuthEnabled,
  isOtpEmailConfigured,
  isOtpSmsConfigured,
  isOtpDebugEnabled,
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
export {
  APPLE_NOT_CONFIGURED,
  AppleAuthError,
  appleAuthorizeUrl,
  appleCallbackUrl,
  decodeAppleState,
  emailFromAppleClaims,
  encodeAppleState,
  exchangeAppleCode,
  isAppleAuthConfigured,
  mintAppleSessionTicket,
  normalizeAppleReturnTo,
  parseAppleUserName,
  verifyAppleIdentityToken,
  verifyAppleSessionTicket,
} from './apple'
export {
  MICROSOFT_NOT_CONFIGURED,
  isMicrosoftAuthConfigured,
  microsoftIssuer,
  microsoftTenantId,
} from './microsoft'
export { AuthProvider } from './client'
import './types'