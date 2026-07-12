import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  isPlatformEntryHost,
  publicTenantUrl,
  resolveHomeTenantForEmail,
  resolveWorkspacesForEmail,
} from '@bevel/tenant-config'
import { auth } from '@/auth'

/**
 * Post-login router.
 * Platform entry (bevel.lvh.me) → org host / workspace picker based on Google Workspace email.
 * Org host → straight into /bevel (tenant realtime namespace = historical chats).
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

  // Hop to the organization's BEVEL host so channels/history bind to that namespace.
  if (onPlatform && target.host !== host) {
    redirect(publicTenantUrl(target, '/^general'))
  }

  // Already on the org host (or soft multi-tenant on same host)
  redirect('/^general')
}
