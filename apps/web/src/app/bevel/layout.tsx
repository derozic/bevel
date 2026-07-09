import type { ReactNode } from 'react'
import { requireTenantFromRequest } from '@bevel/tenant-config'
import { auth } from '@/auth'
import { BevelShell } from '@/components/BevelShell'
import { TenantChrome } from '@/components/TenantChrome'
import { fetchFleetChannels } from '@/lib/fleet-channels.server'
import { fetchSessionSummaries } from '@/lib/realtime-server'

export default async function BevelLayout({ children }: { children: ReactNode }) {
  const tenant = await requireTenantFromRequest()
  const session = await auth()
  const [initialChannels, initialSessions] = session?.user
    ? await Promise.all([
        fetchFleetChannels(session),
        fetchSessionSummaries().catch(() => []),
      ])
    : [undefined, undefined]

  return (
    <div className="bevel-workspace-root">
      <TenantChrome tenant={tenant} />
      <BevelShell initialChannels={initialChannels} initialSessions={initialSessions}>
        {children}
      </BevelShell>
    </div>
  )
}