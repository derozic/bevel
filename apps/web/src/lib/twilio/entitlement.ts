/**
 * SMS / Twilio is a paid product feature (trial | pro | team | enterprise).
 */

import {
  hasFeature,
  isPaidPlan,
  tenantHasSms,
  type Tenant,
} from '@bevel/schema'

export { isPaidPlan, tenantHasSms, hasFeature }

export function smsEntitlementDenied(tenant: Tenant | null | undefined): {
  allowed: false
  status: 402
  error: string
  plan: string
} | null {
  if (!tenant) {
    return {
      allowed: false,
      status: 402,
      error: 'Workspace not resolved',
      plan: 'free',
    }
  }
  if (hasFeature(tenant, 'sms') || tenantHasSms(tenant)) return null
  return {
    allowed: false,
    status: 402,
    error:
      'SMS is available on paid BEVEL plans (Trial, Pro, Team, Enterprise). Upgrade this workspace to enable Twilio OTP and true-sentience alerts.',
    plan: tenant.plan ?? 'free',
  }
}
