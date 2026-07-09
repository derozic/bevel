import NextAuth from 'next-auth'
import { getTenantFromRequest } from '@bevel/tenant-config'
import { createTenantAuthConfig } from '@bevel/auth'

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const tenant = await getTenantFromRequest()
  if (!tenant) {
    throw new Error('BEVEL auth requires a resolved tenant (check Host header / middleware)')
  }
  return createTenantAuthConfig({ tenant })
})