/**
 * Synthetic tenant for apex platform entry hosts (bevel.is, app.bevel.is, …).
 * Real org tenants resolve from Host; this only powers auth UI and Google/OTP
 * on the platform surface so requireTenant does not 500.
 */

import type { Tenant } from '@bevel/schema'
import { isPlatformEntryHost } from './constants'

export const PLATFORM_ENTRY_TENANT: Tenant = {
  id: 'platform',
  slug: 'platform',
  name: 'BEVEL',
  host: 'bevel.is',
  status: 'active',
  plan: 'free',
  featureAccess: 'stable',
  auth: {
    providers: ['google'],
    requireGitHubForWork: false,
  },
  features: {
    channels: true,
    directMessages: true,
    agentDispatch: true,
    workMode: false,
    customBranding: false,
    sms: false,
    otpSms: false,
    presenceSms: false,
    asyncStreams: true,
    liveSessions: true,
    analytics: true,
    liveMedia: false,
    ssoSaml: false,
    auditLog: false,
    dedicatedSupport: false,
    agentMemory: false,
    voiceRooms: false,
    multiRegion: false,
  },
  theme: {
    accent: '#7c5cff',
    productName: 'BEVEL',
    mode: 'dark',
  },
  realtime: {
    namespace: 'platform',
  },
  workRepos: [],
}

/** Host-scoped copy of the platform-entry synthetic tenant. */
export function platformEntryTenant(host: string): Tenant {
  const h = host.toLowerCase().split(':')[0] || 'bevel.is'
  return { ...PLATFORM_ENTRY_TENANT, host: h }
}

export function isPlatformEntryTenantSlug(slug: string | undefined | null): boolean {
  return slug === 'platform'
}

export { isPlatformEntryHost }
