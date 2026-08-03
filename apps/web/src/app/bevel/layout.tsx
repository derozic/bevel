import type { ReactNode } from 'react'
import {
  isPlatformEntryTenantSlug,
  requireTenantFromRequest,
} from '@bevel/tenant-config'
import { auth } from '@/auth'
import {
  AnnouncementProvider,
  AnnouncementStack,
} from '@/components/announcements/AnnouncementHost'
import { BevelShell } from '@/components/BevelShell'
import { LocalMessageIndexBridge } from '@/components/LocalMessageIndexBridge'
import { PLATFORM_HOME_LINKS } from '@/components/TenantChrome'
import { fetchFleetChannels } from '@/lib/fleet-channels.server'
import { fetchSessionSummaries } from '@/lib/realtime-server'
import { BEVEL_PRIVATE_PATH } from '@/lib/bevel'

export default async function BevelLayout({ children }: { children: ReactNode }) {
  const tenant = await requireTenantFromRequest()
  const session = await auth()
  const isPrivateApex = isPlatformEntryTenantSlug(tenant.slug)

  // Apex private: agents only — no org channel list defaults.
  const [initialChannels, initialSessions] = session?.user
    ? await Promise.all([
        isPrivateApex
          ? Promise.resolve([])
          : fetchFleetChannels(session),
        fetchSessionSummaries().catch(() => []),
      ])
    : [undefined, undefined]

  const productName = (
    tenant.theme.productName ??
    tenant.name ??
    tenant.slug
  ).replace(/\s+Agents$/i, '')
  const platformHome = isPrivateApex
    ? { href: BEVEL_PRIVATE_PATH, label: 'Private' }
    : PLATFORM_HOME_LINKS[tenant.slug]

  return (
    <div className="bevel-workspace-root">
      {/* Single brand row lives in the rail — no full-width TenantChrome strip */}
      <AnnouncementProvider tenantSlug={tenant.slug}>
        <LocalMessageIndexBridge />
        <AnnouncementStack placement="top" />
        <BevelShell
          productName={productName}
          platformHomeHref={platformHome?.href}
          platformHomeLabel={platformHome?.label ?? productName}
          initialChannels={initialChannels}
          initialSessions={initialSessions}
          privateAgentsOnly={isPrivateApex}
          plan={tenant.plan}
          featureAccess={tenant.featureAccess}
          featureSet={tenant.featureSet}
        >
          {children}
        </BevelShell>
        <AnnouncementStack placement="bottom" />
      </AnnouncementProvider>
    </div>
  )
}