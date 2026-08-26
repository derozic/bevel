import { NextResponse } from 'next/server'
import { resolveWorkspacesForEmail } from '@bevel/tenant-config'
import { auth } from '@/auth'
import { listWorkspaceSpaces } from '@/lib/workspace-spaces.server'

export const dynamic = 'force-dynamic'

function requestHost(request: Request): string {
  return (
    request.headers.get('x-bevel-host') ??
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase()
    .split(':')[0] || ''
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }

  const host = requestHost(request)
  const { tenants } = resolveWorkspacesForEmail(session.user.email)
  const candidateSlugs = session.workspaceCandidates?.length
    ? session.workspaceCandidates
    : tenants.map((t) => t.slug)

  const spaces = listWorkspaceSpaces({
    fromHost: host,
    candidateSlugs,
  })

  return NextResponse.json({
    current: spaces.find((s) => s.current)?.slug ?? null,
    spaces,
  })
}
