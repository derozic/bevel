import NextAuth from 'next-auth'
import { headers } from 'next/headers'
import {
  getTenantFromRequest,
  isPlatformEntryHost,
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
  if (!tenant) {
    if (host && isPlatformEntryHost(host)) {
      return createTenantAuthConfig({
        tenant: platformEntryTenant(host),
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
