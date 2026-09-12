import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  getTenantFromRequest,
  isPlatformEntryHost,
  platformEntryTenant,
} from '@bevel/tenant-config'
import { HomePage } from '@/components/home/HomePage'
import { auth } from '@/auth'
import { BEVEL_HOME_PATH, BEVEL_PRODUCT } from '@/lib/bevel'

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

  // Apex platform entry (bevel.is / bevel.lvh.me): marketing home when signed
  // out, workspace router when signed in. Never dump visitors onto /login.
  if (isPlatformEntryHost(host)) {
    const session = await auth()
    if (session?.user?.email) redirect('/welcome')
    const platform = platformEntryTenant(host)
    return (
      <HomePage
        tenantName={BEVEL_PRODUCT.name}
        productName={BEVEL_PRODUCT.name}
        tenantSlug={platform.slug}
        namespace={platform.realtime.namespace}
        plan={platform.plan}
        featureAccess={platform.featureAccess}
        featureSet={platform.featureSet}
        signedIn={false}
        userName={null}
      />
    )
  }

  const tenant = await getTenantFromRequest()

  // Tenant host without resolution → claim / workspace finder
  if (!tenant) {
    redirect('/workspaces')
  }

  const session = await auth()

  // Signed-in org host → default channel (tilde path, never encoded)
  if (session?.user?.email) {
    redirect(BEVEL_HOME_PATH)
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
      signedIn={false}
      userName={null}
    />
  )
}
