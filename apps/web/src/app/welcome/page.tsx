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
 * Platform entry (bevel.is) → org host / workspace picker based on Google Workspace email.
 * Org host → straight into /^general (tenant realtime namespace = historical chats).
 *
 * When platform and org hosts sit on different registrable domains
 * (bevel.is vs bevel.2x4m.cc), cookies cannot hop — issue a Postgres-backed
 * one-time handoff code and land on /api/auth/handoff on the org host.
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

  if (session.needsWorkspacePick || (!home && tenants.length > 1)) {
    redirect('/workspaces')
  }

  // No org yet — claim a namespace instead of a dead-end AccessDenied.
  if (!home && tenants.length === 0) {
    redirect('/claim')
  }

  const target = home ?? tenants[0]!
  const onPlatform = isPlatformEntryHost(host)
  const callbackPath = '/^general'

  // Hop to the organization's BEVEL host so channels/history bind to that namespace.
  if (onPlatform && target.host !== host) {
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
      // Fall through to plain hop if API unavailable (may land logged-out — ops alert)
      console.error(
        '[welcome] handoff issue failed; falling back to bare org redirect',
      )
    }

    redirect(publicTenantUrl(target, callbackPath))
  }

  // Already on the org host — relative redirect only (never rebuild absolute
  // URLs from AUTH_URL / bind host; that caused https://localhost:41009/%5Egeneral).
  redirect(callbackPath)
}
