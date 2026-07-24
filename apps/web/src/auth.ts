import NextAuth from 'next-auth'
import { headers } from 'next/headers'
import {
  getTenantFromRequest,
  isPlatformEntryHost,
  isPlatformHost,
  platformEntryTenant,
} from '@bevel/tenant-config'
import { createTenantAuthConfig } from '@bevel/auth'

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
  if (tenant) {
    return createTenantAuthConfig({ tenant, host })
  }

  // Never throw on platform / status / unknown hosts — synthetic tenant keeps
  // Auth.js and handoff endpoints up so the product does not 500 when down.
  const fallbackHost = host || 'bevel.is'
  if (!host || isPlatformEntryHost(host) || isPlatformHost(host)) {
    return createTenantAuthConfig({
      tenant: platformEntryTenant(fallbackHost),
      host: fallbackHost,
    })
  }

  // Unknown customer host without registry match: still allow login shell
  // so claim / workspace pick can proceed.
  return createTenantAuthConfig({
    tenant: platformEntryTenant(fallbackHost),
    host: fallbackHost,
  })
})

export { isPlatformEntryHost }
