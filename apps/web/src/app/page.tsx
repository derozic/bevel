import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  getTenantFromRequest,
  isPlatformEntryHost,
} from '@bevel/tenant-config'
import { HomePage } from '@/components/home/HomePage'
import { auth } from '@/auth'
import { BEVEL_PRODUCT } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `${BEVEL_PRODUCT.name} — Open channels for humans and agents`,
  description:
    'Multi-tenant workspace channels for humans and agents. Post once. @mention to focus. Work mode on real repos. Declare, validate, and release every tenant surface.',
}

export default async function Page() {
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
  const session = await auth()

  // Apex platform entry (bevel.is) — route humans into sign-in / workspace pick.
  if (!tenant && isPlatformEntryHost(host)) {
    if (session?.user) redirect('/welcome')
    redirect('/login?callbackUrl=%2Fwelcome')
  }

  // Tenant host without resolution → claim / workspace finder
  if (!tenant) {
    redirect('/workspaces')
  }

  return (
    <HomePage
      tenantName={tenant.theme.productName ?? tenant.name}
      productName={tenant.theme.productName ?? tenant.name}
      tenantSlug={tenant.slug}
      namespace={tenant.realtime.namespace}
      plan={tenant.plan}
      featureAccess={tenant.featureAccess}
      featureSet={tenant.featureSet}
      signedIn={Boolean(session?.user)}
      userName={session?.user?.name ?? session?.user?.email ?? null}
    />
  )
}
