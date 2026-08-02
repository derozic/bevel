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

/**
 * Post-login router.
 *
 * Platform (bevel.is):
 * - 0 workspaces → /claim
 * - N>1 → /workspaces (picker) — never silent 2x4m
 * - 1 workspace → /workspaces still when BEVEL_PLATFORM_AUTO_HANDOFF=0 (dogfood),
 *   else handoff to that org
 *
 * Org host → /~general with handoff when needed.
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
  const { tenants, preferred } = resolveWorkspacesForEmail(email)
  const home = preferred ?? resolveHomeTenantForEmail(email)
  const onPlatform = isPlatformEntryHost(host)

  // Multi-workspace or explicit pick flag → always show chooser on platform.
  if (session.needsWorkspacePick || tenants.length > 1) {
    redirect('/workspaces')
  }

  if (!home && tenants.length === 0) {
    // Apex home with empty memberships (profile still valid)
    if (onPlatform) {
      redirect('/account')
    }
    redirect('/claim')
  }

  const target = home ?? tenants[0]!
  const callbackPath = '/~general'

  // Dogfood: stay on apex and open picker even for a single workspace.
  const autoHandoff =
    process.env.BEVEL_PLATFORM_AUTO_HANDOFF !== '0' &&
    process.env.BEVEL_PLATFORM_AUTO_HANDOFF !== 'false'

  if (onPlatform) {
    if (!autoHandoff) {
      redirect('/workspaces')
    }
    if (target.host.toLowerCase().split(':')[0] !== host) {
      const orgHost = target.host.toLowerCase().split(':')[0] || target.host

      if (needsAuthHandoff(host, orgHost)) {
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
      }

      redirect(publicTenantUrl(target, callbackPath))
    }
  }

  // Already on the org host — relative redirect to default channel.
  redirect(callbackPath)
}
