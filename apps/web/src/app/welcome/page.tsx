import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  isPlatformEntryHost,
  needsAuthHandoff,
  publicTenantUrl,
  resolveHomeTenantForEmail,
  resolveWorkspacesForEmail,
} from '@bevel/tenant-config'
import { auth } from '@/auth'
import { issueAuthHandoffCode } from '@/lib/auth-handoff'
import { BEVEL_HOME_PATH, BEVEL_PRIVATE_PATH } from '@/lib/bevel'

/**
 * Post-login router.
 *
 * Platform (bevel.is):
 * - Always offer a chooser when the email has ≥1 product workspace
 *   (private + orgs) so admins can pick where to enter.
 * - 0 workspaces → private /me only.
 *
 * Org host: open default channel (with handoff when needed).
 */
export default async function WelcomePage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=%2Fwelcome')
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

  const email = session.user.email
  const { tenants } = resolveWorkspacesForEmail(email)
  const onPlatform = isPlatformEntryHost(host)

  if (onPlatform) {
    // Member of any product workspace → pick private vs org (or multi-org).
    if (tenants.length >= 1 || session.needsWorkspacePick) {
      redirect('/workspaces')
    }
    // No org memberships — private agents only.
    redirect(BEVEL_PRIVATE_PATH)
  }

  const home = resolveHomeTenantForEmail(email)

  if (session.needsWorkspacePick || tenants.length > 1) {
    redirect('/workspaces')
  }

  if (!home && tenants.length === 0) {
    redirect(BEVEL_PRIVATE_PATH)
  }

  const target = home ?? tenants[0]!
  const callbackPath = BEVEL_HOME_PATH
  const orgHost = target.host.toLowerCase().split(':')[0] || target.host

  if (orgHost !== host && needsAuthHandoff(host, orgHost)) {
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
    console.error(
      '[welcome] handoff issue failed; falling back to bare org redirect',
    )
    redirect(publicTenantUrl(target, callbackPath))
  }

  if (orgHost !== host) {
    redirect(publicTenantUrl(target, callbackPath))
  }

  redirect(callbackPath)
}
