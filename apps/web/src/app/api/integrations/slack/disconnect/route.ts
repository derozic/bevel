import { NextResponse } from 'next/server'
import { getTenantFromRequest } from '@bevel/tenant-config'
import { auth } from '@/auth'
import { deleteWorkspaceSlack } from '@/lib/slack/workspace-config'

export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const tenant = await getTenantFromRequest()
  const slug = tenant?.slug || 'platform'
  deleteWorkspaceSlack(slug)
  return NextResponse.json({ ok: true, connected: false, tenantSlug: slug })
}
