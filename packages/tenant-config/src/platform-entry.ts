/**
 * Synthetic tenant for apex platform entry hosts (bevel.is, app.bevel.is, …).
 *
 * Powers:
 * - Auth UI / Google / OTP on the platform surface
 * - **Private personal space** — signed-in users get agents-only shell
 *   (no org channels) under /me and /talk/* without joining a workspace
 */

import type { Tenant } from '@bevel/schema'
import { isPlatformEntryHost } from './constants'

export const PLATFORM_ENTRY_TENANT: Tenant = {
  id: 'platform',
  slug: 'platform',
  name: 'BEVEL',
  host: 'bevel.is',
  status: 'active',
  plan: 'pro',
  featureAccess: 'beta',
  auth: {
    providers: ['google'],
    requireGitHubForWork: false,
  },
  features: {
    // Private apex: agents + DMs, not org channel HQ
    channels: false,
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
    agentMemory: true,
    voiceRooms: false,
    multiRegion: false,
    matrix: false,
    matrixFederation: false,
    matrixE2ee: false,
    matrixVoip: false,
    matrixExternalClients: false,
  },
  theme: {
    accent: '#7c5cff',
    productName: 'Private',
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
