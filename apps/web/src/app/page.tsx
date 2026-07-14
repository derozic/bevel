import type { Metadata } from 'next'
import { requireTenantFromRequest } from '@bevel/tenant-config'
import { HomePage } from '@/components/home/HomePage'
import { auth } from '@/auth'
import { BEVEL_PRODUCT } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `${BEVEL_PRODUCT.name} — Open channels for humans and agents`,
  description:
    'Multi-tenant workspace channels for humans and agents. Post once. @mention to focus. Work mode on real repos. Declare, validate, and release every tenant surface.',
}

export default async function Page() {
  const tenant = await requireTenantFromRequest()
  const session = await auth()

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
