import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  isPlatformEntryHost,
  isPreviewHost,
  needsAuthHandoff,
  publicTenantUrl,
  resolveHomeTenantForEmail,
  resolveWorkspacesForEmail,
  tenantPublicHost,
} from '@bevel/tenant-config'
import { auth } from '@/auth'
import { issueAuthHandoffCode } from '@/lib/auth-handoff'
import { BEVEL_HOME_PATH, BEVEL_PRIVATE_PATH } from '@/lib/bevel'
import {
  NATIVE_COMPLETE_PATH,
  isNativeLoginPending,
} from '@/lib/auth-native'

/**
 * Post-login router — clean model:
 *
 * Apex (bevel.is): always Space chooser (Private + memberships).
 * Org host: that workspace only (or chooser if multi + wrong host).
 */
export default async function WelcomePage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=%2Fwelcome')
  }

  if (await isNativeLoginPending()) {
    redirect(NATIVE_COMPLETE_PATH)
  }

  const headerStore = await headers()
  const host = (
    headerStore.get('x-bevel-host') ??
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    ''
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase()
    .split(':')[0] || ''

  // Apex: always chooser (Private is always listed there).
  if (isPlatformEntryHost(host)) {
    redirect('/workspaces')
  }

  const email = session.user.email
  const { tenants } = resolveWorkspacesForEmail(email)
  const home = resolveHomeTenantForEmail(email)

  if (session.needsWorkspacePick || tenants.length > 1) {
    redirect('/workspaces')
  }

  if (!home && tenants.length === 0) {
    redirect(BEVEL_PRIVATE_PATH)
  }

  const target = home ?? tenants[0]!
  const callbackPath = BEVEL_HOME_PATH
  const orgHost = tenantPublicHost(target, host)

  if (
    orgHost !== host &&
    process.env.NODE_ENV === 'production' &&
    !isPreviewHost(host) &&
    !isPreviewHost(orgHost) &&
    needsAuthHandoff(host, orgHost)
  ) {
    const issued = await issueAuthHandoffCode({
      email,
      name: session.user.name,
      imageUrl: session.user.image,
      tenantSlug: target.slug,
      callbackPath,
    })
    if (issued?.code) {
      const dest = new URL(`https://${orgHost}/api/auth/handoff`)
      dest.searchParams.set('code', issued.code)
      dest.searchParams.set('callbackUrl', callbackPath)
      redirect(dest.toString())
    }
    redirect(publicTenantUrl(target, callbackPath, host))
  }

  if (orgHost !== host) {
    redirect(publicTenantUrl(target, callbackPath, host))
  }

  redirect(callbackPath)
}
