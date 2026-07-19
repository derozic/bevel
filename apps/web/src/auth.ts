import NextAuth from 'next-auth'
import { headers } from 'next/headers'
import type { Tenant } from '@bevel/schema'
import {
  getTenantFromRequest,
  isPlatformEntryHost,
} from '@bevel/tenant-config'
import { createTenantAuthConfig } from '@bevel/auth'

/**
 * Synthetic tenant for apex platform entry (bevel.is).
 * Real org tenants resolve from Host; this only powers Google/OTP on the entry surface.
 */
const PLATFORM_ENTRY_TENANT: Tenant = {
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
    productName: 'BEVEL',
    mode: 'dark',
  },
  realtime: {
    namespace: 'platform',
  },
  workRepos: [],
}

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const headerStore = await headers()
  const host = (
    headerStore.get('x-bevel-host') ??
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    ''
  )
    .toLowerCase()
    .split(':')[0]

  const tenant = await getTenantFromRequest()
  if (!tenant) {
    if (host && isPlatformEntryHost(host)) {
      return createTenantAuthConfig({
        tenant: { ...PLATFORM_ENTRY_TENANT, host },
        host,
      })
    }
    throw new Error(
      'BEVEL auth requires a resolved tenant (check Host header / middleware)',
    )
  }

  return createTenantAuthConfig({
    tenant,
    host,
  })
})

export { isPlatformEntryHost }
