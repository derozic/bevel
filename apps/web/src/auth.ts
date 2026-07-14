import NextAuth from 'next-auth'
import { headers } from 'next/headers'
import {
  getTenantFromRequest,
  isPlatformEntryHost,
} from '@bevel/tenant-config'
import { createTenantAuthConfig } from '@bevel/auth'

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const tenant = await getTenantFromRequest()
  if (!tenant) {
    throw new Error(
      'BEVEL auth requires a resolved tenant (check Host header / middleware)',
    )
  }

  const headerStore = await headers()
  const host = (
    headerStore.get('x-bevel-host') ??
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    ''
  )
    .toLowerCase()
    .split(':')[0]

  return createTenantAuthConfig({
    tenant,
    host,
    // Platform entry uses shared cookie domain for org hops when configured.
  })
})

export { isPlatformEntryHost }
